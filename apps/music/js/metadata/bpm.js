/* exported AudioBPM */
'use strict';

var spotifyApi = new SpotifyWebApi();
var echonestApi = new EchonestApi();

var AudioBPM = (function() {
  function query(metadata, callback) {
    var input = metadata.artist + ' - ' +  metadata.title;

    spotifyApi.searchTracks(input.trim(), {limit: 1}).then(function(results) {
      var track = results.tracks.items[0];

      if (!track) {
        callback(metadata);
        return;
      }

      echonestApi.getSongAudioSummaryBySpotifyUri(track.uri).then(function(result) {
        if (result.response.status.code === 0 && result.response.songs.length > 0) {
          var tempo = result.response.songs[0].audio_summary.tempo;
          metadata.bpm = Math.round(tempo);
          callback(metadata);
        } else {
          if (result.response.status.code === 5) {
            // The track couldn't be found. Fallback to search in EN
            echonestApi.searchSongs(track.artists[0].name, track.name).then(function(result) {
              if (result.response.status.code === 0 && result.response.songs.length > 0) {
                echonestApi.getSongAudioSummaryById(result.response.songs[0].id).then(function(result) {
                  if (result.response.status.code === 0 && result.response.songs.length > 0) {
                    var tempo = result.response.songs[0].audio_summary.tempo;
                    metadata.bpm = Math.round(tempo);
                    callback(metadata);
                  }
                });
              }
            });
          }
        }
      });
    });
  }

  return {
    query: query
  };
})();
