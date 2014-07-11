/*
 * Media App Agent(MAA) is a system submodule for low-end devices to take charge
 * of the media app, it should only enable on the devices with limited memory.
 *
 * MAA checks the media app's play status to decide if system should kill it
 * when mozmemorypressure event comes then free memory for the foreground app
 * to use.
 */

'use strict';

var MediaAppAgent = {
  playStatus: 'STOPPED',

  get origin() {
    return this._origin;
  },

  set origin(url) {
    if (url && url !== this.origin) {
      this._handleMediaAppFrame(url);
    }

    return this._origin = url;
  },

  init: function maa_init() {
    this.origin = null;
    // When we receive the mozmemorypressure event, check the media app status
    // to decide if we can close it to release the memory that supposed to be
    // freed if the media app is out-of-process.
    window.addEventListener(
      'mozmemorypressure', this._handleMemorypressure.bind(this)
    );
  },

  _handleMediaAppFrame: function maa_handleMediaAppFrame(url) {
    var appFrame = WindowManager.getAppFrame(url);

    if (appFrame) {
      appFrame.addEventListener('mozbrowsererror', function(evt) {
        // See if evt.detail.type helps here.
        this.origin = null;
      }.bind(this));
    }
  },

  _handleMemorypressure: function maa_handleMemorypressure(event) {
    WindowManager.kill(this.origin);
  }
};

MediaAppAgent.init();
