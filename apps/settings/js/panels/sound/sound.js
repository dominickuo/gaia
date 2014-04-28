/* global getSupportedNetworkInfo, URL, MozActivity */
/**
 * Handle sound panel functionality
 */
define(function(require) {
  'use strict';

  var ForwardLock = require('shared/omadrm/fl');
  var SettingsListener = require('shared/settings_listener');

  var Sound = function() {
    this.elements = null;
    this.tones = null;
  };

  Sound.prototype = {
    /**
     * initialization
     */
    init: function sound_init(elements) {
      this.elements = elements;

      if (window.navigator.mozMobileConnections) {
        var mobileConnections = window.navigator.mozMobileConnections;
        // Show the touch tone selector if and only if we're on a CDMA network
        var toneSelector = this.elements.toneSelector;
        Array.prototype.forEach.call(mobileConnections,
          function(mobileConnection) {
            getSupportedNetworkInfo(mobileConnection, function(result) {
              toneSelector.hidden = toneSelector.hidden && !result.cdma;
            });
        });
      }

      // initialize the ring tone and alert tone menus.
      this._configureTones();
      this._handleTones();
    },

    uninit: function sound_uninit() {
      this.elements = null;
      this.tones = null;
    },

    _configureTones: function sound_configureTones() {
      /**
       * This array has one element for each selectable tone that appears in the
       * "Tones" section of  ../elements/sound.html.
       */
      this.tones = [{
        pickType: 'alerttone',
        settingsKey: 'notification.ringtone',
        allowNone: true,  // Allow "None" as a choice for alert tones.
        button: this.elements.alertTone
      }];

      // If we're a telephone, then show the section for ringtones, too.
      if (navigator.mozTelephony) {
        this.tones.push({
          pickType: 'ringtone',
          settingsKey: 'dialer.ringtone',
          allowNone: false, // The ringer must always have an actual sound.
          button: this.elements.ringTone
        });
        this.elements.ringer.hidden = false;
      }
    },

    _handleTones: function sound_handleTones() {
      var _ = navigator.mozL10n.get;
      var self = this;

      // For each kind of tone, hook up the button that will allow the user
      // to select a sound for that kind of tone.
      this.tones.forEach(function(tone) {
        var pathkey = tone.settingsKey + '.filepath';
        // The button looks like a select element. By default it just reads
        // "change". But we want it to display the name of the current tone.
        // So we look up that name in the settings database.
        SettingsListener.observe(
          pathkey, '', self._checkToneFilepath.bind(self, tone)
        );

        // When the user clicks the button, we launch an activity that lets
        // the user select new ringtone.
        tone.button.onclick = function() {
          /**
           * Before we can start the Pick activity, we need to know if there
           * is locked content on the phone because we don't want the user to
           * see "Purchased Media" as a choice if there isn't any purchased
           * media on the phone. The ForwardLock secret key is not generated
           * until it is needed, so we can use its existance to
           * determine whether to show the Purchased Media app.
           */
          ForwardLock.getKey(function(secret) {
            var activity = new MozActivity({
              name: 'pick',
              data: {
                type: tone.pickType,
                allowNone: tone.allowNone,
                // If we have a secret then there is locked content on the phone
                // so include it as a choice for the user
                includeLocked: (secret !== null)
              }
            });

            activity.onsuccess = function() {
              var blob = activity.result.blob;  // The returned ringtone sound
              var name = activity.result.name;  // The name of this ringtone
              var filepath = activity.result.filepath;  // The filepath

              if (!blob) {
                if (tone.allowNone) {
                  // If we allow a null blob, then everything is okay
                  self._setRingtone(blob, name, filepath, tone);
                } else {
                  // Otherwise this is an error and we should not change the
                  // current setting. (The ringtones app should never return
                  // a null blob if allowNone is false, but other apps might.)
                  alert(_('unplayable-ringtone'));
                }
                return;
              }

              // If we got a locked ringtone, we have to unlock it first
              if (blob.type.split('/')[1] === ForwardLock.mimeSubtype) {
                ForwardLock.unlockBlob(secret, blob, function(unlocked) {
                  self._checkRingtone(unlocked, name, filepath, tone);
                });
              } else {  // Otherwise we can just use the blob directly.
                self._checkRingtone(blob, name, filepath, tone);
              }
            };
          });
        };
      });
    },

    // Use the file path as id to check what type the tone is, it could be:
    // 1. Preloaded. 2. None. 3. Customized(set from the music app).
    _checkToneFilepath: function sound_checkToneFilepath(tone, filepath) {
      var self = this;
      var _ = navigator.mozL10n.get;
      var namekey = tone.settingsKey + '.name';
      // Check the filepath to see if the tone is from the preloaded pool.
      if (filepath.indexOf('shared/resources/media') !== -1) {
        var filename = filepath.split('/').pop();
        var key = filename.replace('.', '_');

        self._displayToneName(tone, _(key), key);
      }
      else if (filepath === 'none') {
        self._displayToneName(tone, _('none'), 'none');
      }
      else {
        SettingsListener.observe(
          namekey, '', function setCustomizedToneName(tonename) {
            SettingsListener.unobserve(namekey, setCustomizedToneName);
            // If the user selected a ringtone without title from the music app,
            // then we display "Change" instead of an empty string?
            self._displayToneName(tone, tonename || _('change'), '');
          }
        );
      }
    },

    // Also assign the L10n id because the preloaded tones have localized names.
    _displayToneName: function sound_displayToneName(tone, name, id) {
      tone.button.textContent = name;
      tone.button.dataset.l10nId = id;
    },

    /**
     * Make sure that the blob we got from the activity is actually
     * a playable audio file. It would be very bad to set an corrupt
     * blob as a ringtone because then the phone wouldn't ring!
     */
    _checkRingtone: function sound_checkRingtone(blob, name, filepath, tone) {
      var _ = navigator.mozL10n.get;
      var oldRingtoneName = tone.button.textContent;
      tone.button.textContent = _('savingringtone');

      var player = new Audio();
      player.preload = 'metadata';
      player.src = URL.createObjectURL(blob);
      player.oncanplay = function() {
        release();
        // this will update the button text
        this._setRingtone(blob, name, filepath, tone);
      }.bind(this);
      player.onerror = function() {
        release();
        tone.button.textContent = oldRingtoneName;
        alert(_('unplayable-ringtone'));
      };

      function release() {
        URL.revokeObjectURL(player.src);
        player.removeAttribute('src');
        player.load();
      }
    },
    /*
     * Save the sound in the settings db so that other apps can
     * use it.
     * Also save the sound name in the db so we can display it in the future.
     * And update the button text to the new name now.
     */
    _setRingtone: function sound_setRingtone(blob, name, filepath, tone) {
      // Update the settings database. This will cause the button
      // text to change as well because of the SettingsListener above.
      var values = {};
      values[tone.settingsKey] = blob;
      values[tone.settingsKey + '.name'] = name || '';
      values[tone.settingsKey + '.filepath'] = filepath;
      navigator.mozSettings.createLock().set(values);
    }
  };

  return function ctor_sound() {
    return new Sound();
  };
});
