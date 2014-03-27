/* global ModeManager, ListView, SubListView, PlayerView, TabBar */
/* global LazyLoader, asyncStorage */

'use strict';

var LAST_STATE_KEY = 'settings_option_key';
var SAVE_FREQUENCY = 3000;

var StateManager = {
  isRestoring : false,

  init: function() {
    this.isRestoring = true;
    this._startStoreTimer();
  },

  save: function() {
    var state = {
      modeStack: ModeManager._modeStack,
      tabOption: TabBar.option,
      lastListInfo: ListView.info,
      lastSubListInfo: SubListView.info,
      lastPlaylist: (typeof PlayerView !== 'undefined') ?
        PlayerView.dataSource : null,
      lastStatus: (typeof PlayerView !== 'undefined') ?
        PlayerView.playStatus : 'STOPPED'
    };

    asyncStorage.setItem(LAST_STATE_KEY, state);
  },

  restore: function(callback) {
    asyncStorage.getItem(LAST_STATE_KEY, function(state) {
      if (state) {
        this._constructUI(state, callback);
      }
    }.bind(this));
  },

  _startStoreTimer: function() {
    window.setTimeout(function() {
      this.save();
      console.log('Saved');
      this._startStoreTimer();
    }.bind(this), SAVE_FREQUENCY);
  },

  _constructUI: function(state, callback) {
    state.modeStack.forEach(function(mode, index) {
      if (index === 0) {
        ModeManager.start(mode);
      } else {
        ModeManager.push(mode);
      }
    });

    this._renderTab(state.tabOption);
    this._renderListView(state.lastListInfo);
    // this._renderSubListView(state.lastSubListInfo);
    this._renderPlayerView(state.lastStatus, state.lastPlaylist);

    callback();
  },

  _renderTab: function(option) {
    window.location.hash = '#' + option;
    TabBar.option = option;
  },

  _renderListView: function(info) {
    ListView.activate(info);

    if (!info) {
      TabBar.playlistArray.forEach(function(playlist) {
        ListView.update('playlist', playlist);
      });
    }
  },

  _renderSubListView: function(info) {
    if (info) {
      SubListView.activate(
        info.option, info.data, info.index, info.keyRange, info.direction
      );
    }
  },

  _renderPlayerView: function(status, playlist) {
    if (status !== 'STOPPED') {
      var playerLoaded = (typeof PlayerView != 'undefined');

      LazyLoader.load('js/Player.js', function() {
        if (!playerLoaded) {
          PlayerView.init();
        }

        PlayerView.setSourceType('list');
        PlayerView.dataSource = playlist;
        PlayerView.play(0);
      });
    }
  }
};

StateManager.init();
