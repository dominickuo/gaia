/* global showCurrentView, TilesView, ListView, SubListView */

'use strict';

var Visibility = {
  init: function() {
    window.addEventListener(
      'visibilitychange', this._visibilityHandler.bind(this)
    );
  },

  _visibilityHandler: function(event) {
    if (document.hidden) {
      this.cleanViews();
    } else {
      this.createViews();
    }
  },

  createViews: function() {
    console.log('createViews');
    showCurrentView();
  },

  cleanViews: function() {
    console.log('cleanViews');
    TilesView.clean();
    ListView.clean();
    SubListView.clean();
  }
};

Visibility.init();
