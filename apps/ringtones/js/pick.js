navigator.mozSetMessageHandler('activity', function handler(activity) {
  var selectedSoundName, selectedSoundURL;
  var baseURL, listURL, settingKey;
  var toneType = activity.source.data.type;
  var allowNone = activity.source.data.allowNone;

  // Handle the case where toneType is an array. Note that we can't
  // display both types of tones at once. But a client might ask for
  // a ringtone or 'audio/mpeg' and we have to handle that.
  if (typeof toneType === 'object') {
    if (toneType.indexOf('ringtone') !== -1)
      toneType = 'ringtone';
    else if (toneType.indexOf('alerttone') !== -1)
      toneType = 'alerttone';
  }

  switch (toneType) {
  case 'ringtone':
    baseURL = '/shared/resources/media/ringtones/';
    listURL = '/shared/resources/media/ringtones/list.json';
    settingKey = 'dialer.ringtone.name';
    break;

  case 'alerttone':
    baseURL = '/shared/resources/media/notifications/';
    listURL = '/shared/resources/media/notifications/list.json';
    settingKey = 'notification.ringtone.name';
    break;

  default:
    activity.postError('pick type not supported');
    break;
  }

  // UI elements
  var title = document.getElementById('title');
  var done = document.getElementById('done');
  var cancel = document.getElementById('cancel');
  var player = document.createElement('audio'); // for previewing sounds

  // Start off with the Done button disabled, and only enable it once
  // a button has been checked
  done.disabled = true;

  // Localize the titlebar text based on the tone type
  navigator.mozL10n.localize(title, toneType + '-title');

  cancel.onclick = function() {
    activity.postError('cancelled');
  };

  done.onclick = function() {
    if (selectedSoundURL) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', selectedSoundURL);
      // XXX
      // This assumes that all system tones are ogg files
      // Maybe map based on the extension instead?
      xhr.overrideMimeType('audio/ogg');
      xhr.responseType = 'blob';
      xhr.send();
      xhr.onload = function() {
        activity.postResult({
          name: selectedSoundName,
          blob: xhr.response
        });
      };
    }
    else if (allowNone && selectedSoundURL === '') {  // Handle the 'None' case
      activity.postResult({
        name: selectedSoundName,
        blob: null
      });
    }
    else {
      // This should never happen. But if it does for some reason, then
      // behave as if the user clicked the cancel (Back) button.
      activity.postError('cancelled');
    }
  };

  // When we start up, we first need to get the list of all sounds.
  // We also need the name of the currently selected sound.
  // Then we need to get localized names for the sounds.
  // Then we can build our UI.
  getSoundFilenames(function(filenames) {
    getCurrentSoundName(function(currentSoundName) {
      getSoundNames(filenames, function(sounds) {
        buildUI(sounds, currentSoundName);
      });
    });
  });

  // Read the list.json file to get the names of all sounds we know about
  // and pass an array of filenames to the callback function. These filenames
  // are relative to baseURL.
  function getSoundFilenames(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', listURL);
    xhr.responseType = 'json';
    xhr.send(null);

    xhr.onload = function() {
      // The list.json file organizes the sound urls as an object instead of
      // an array for some reason
      var filenames = [];
      for (var name in xhr.response) {
        filenames.push(name);
      }
      callback(filenames);
    };

    xhr.onerror = function() {
      console.error('Could not read sounds list', listURL, xhr.status);
    };
  }

  function getCurrentSoundName(callback) {
    navigator.mozSettings.createLock().get(settingKey).onsuccess = function(e) {
      callback(e.target.result[settingKey]);
    };
  }

  // Wait until localization is done, then obtain localized names for each
  // each of the sound filenames, and invoke the callback with an object
  // that maps human-readable sound names to sound URLs
  function getSoundNames(filenames, callback) {
    navigator.mozL10n.ready(function() {
      var sounds = {};
      filenames.forEach(function(filename) {
        var key = filename.replace('.', '_');
        var name = navigator.mozL10n.get(key);
        if (!name) {
          var prefix = toneType === 'alerttone' ? 'notifier_' : 'ringer_';
          name = filename
            .replace(prefix, '')      // strip prefix
            .replace(/\..+$/, '')     // strip suffix
            .replace('_', ' ');       // convert underscores to spaces
        }
        var url = baseURL + filename;
        sounds[name] = url;
      });

      callback(sounds);
    });
  }

  function buildUI(sounds, currentSoundName) {
    var list = document.getElementById('sounds');

    // If 'None' is a valid option, put it at the top of the list
    // Note that we use an empty URL to represent the "None" option
    // and that this is different than an undefined or null URL.
    if (allowNone) {
      list.appendChild(buildListItem(navigator.mozL10n.get('none'), ''));
    }

    for (var name in sounds) {
      var url = sounds[name];
      list.appendChild(buildListItem(name, url));
    }

    function buildListItem(name, url) {
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'sounds';

      if (name === currentSoundName) {
        // Start off with the current sound selected.
        selectedSoundName = name;
        selectedSoundURL = url;
        input.checked = true;
        done.disabled = false; // Done is only disabled if no button is checked
      }
      input.onchange = function(e) {
        if (input.checked) {
          selectedSoundName = name;
          selectedSoundURL = url;
          done.disabled = false; // If something is checked, enable Done
          preview(url);
        }
      };

      var span = document.createElement('span');

      var label = document.createElement('label');
      label.classList.add('pack-radio');
      label.appendChild(input);
      label.appendChild(span);

      var sound = document.createElement('anchor');
      sound.classList.add('sound-name');
      sound.textContent = name;

      var listItem = document.createElement('li');
      listItem.appendChild(label);
      listItem.appendChild(sound);

      return listItem;
    }
  }

  function preview(url) {
    if (url) {  // If there is a URL, play it.
      // player.src = url;
      // player.play();
      CrossfadePlaylistSample.play();
    }
    else {      // Otherwise, the user clicked None, so stop playing anything
      player.removeAttribute('src');
      player.load();
    }
  }
});


function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  };

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  };

  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};


// Keep track of all loaded buffers.
var BUFFERS = {};
// Page-wide audio context.
var context = null;

// An object to track the buffers to load {name: path}
var BUFFERS_TO_LOAD = {
  jam: '/shared/resources/media/ringtones/ringer_classic_prism.ogg',
  crowd: '/shared/resources/media/ringtones/ringer_classic_courier.opus'
};

// Loads all sound samples into the buffers object.
function loadBuffers() {
  // Array-ify
  var names = [];
  var paths = [];
  for (var name in BUFFERS_TO_LOAD) {
    var path = BUFFERS_TO_LOAD[name];
    names.push(name);
    paths.push(path);
  }
  bufferLoader = new BufferLoader(context, paths, function(bufferList) {
    for (var i = 0; i < bufferList.length; i++) {
      var buffer = bufferList[i];
      var name = names[i];
      BUFFERS[name] = buffer;
    }
  });
  bufferLoader.load();
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    // context.mozAudioChannelType = 'ringer';
  }
  catch (e) {
    alert('Web Audio API is not supported in this browser');
  }
  loadBuffers();
  // window.setTimeout(CrossfadePlaylistSample.play, 5000);
});

var CrossfadePlaylistSample = {
  FADE_TIME: 1, // Seconds
  playing: false
};

CrossfadePlaylistSample.play = function() {
  var ctx = this;
  context.mozAudioChannelType = 'ringer';
  console.log('mozAudioChannelType is set!');
  playHelper(BUFFERS.jam, BUFFERS.crowd);

  function createSource(buffer) {
    var source = context.createBufferSource();
    var gainNode = context.createGain ?
      context.createGain() : context.createGainNode();
    source.buffer = buffer;
    // Connect source to gain.
    source.connect(gainNode);
    // Connect gain to destination.
    gainNode.connect(context.destination);

    return {
      source: source,
      gainNode: gainNode
    };
  }

  function playHelper(bufferNow, bufferLater) {
    var playNow = createSource(bufferNow);
    var source = playNow.source;
    ctx.source = source;
    var gainNode = playNow.gainNode;
    var duration = bufferNow.duration;
    var currTime = context.currentTime;
    // Fade the playNow track in.
    gainNode.gain.linearRampToValueAtTime(0, currTime);
    gainNode.gain.linearRampToValueAtTime(1, currTime + 1);
    // Play the playNow track.
    source.start ? source.start(0) : source.noteOn(0);
    // At the end of the track, fade it out.
    gainNode.gain.linearRampToValueAtTime(1, currTime + duration - 1);
    gainNode.gain.linearRampToValueAtTime(0, currTime + duration);
    // Schedule a recursive track change with the tracks swapped.
    // var recurse = arguments.callee;
    // ctx.timer = setTimeout(function() {
      // recurse(bufferLater, bufferNow);
    // }, (duration - 1) * 1000);
  }

};

CrossfadePlaylistSample.stop = function() {
  clearTimeout(this.timer);
  this.source.stop ? this.source.stop(0) : this.source.noteOff(0);
};

CrossfadePlaylistSample.toggle = function() {
  this.playing ? this.stop() : this.play();
  this.playing = !this.playing;
};
