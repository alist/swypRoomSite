_.mixin(_.str.exports());

window.Swyp = Ember.Application.create();

Swyp.errorView = Ember.View.create({
  templateName: 'errors',
  errors: [],
  multiple_errors: function(){
    return this.get('errors').length > 1;
  }.property('errors')
});

Swyp.errorView.addObserver('errors', function(){
  if(this.get('errors').length){
    $('#concept_errors').fadeIn(500, function(){
      $(this).delay(4000).fadeOut();
    });
  }
});


Swyp.Document = Ember.Object.extend({
  objectId: null,
  file: null,
  fileName: function(){
    var file_parts = _.last(this.get('file').name.split('.')).split('_');
    return file_parts[1]+' '+file_parts[0];
  }.property('file'),
  fileSize: function(){ 
    return this.get('file').size;
  }.property('file'),
  fileType: function(){
    return this.get('file').__type;
  }.property('file'),
  user: null,
  url: function(){
    return this.get('file').url;
  }.property('file'),
  thumbnail: null,
  thumbURL: function(){
    return this.get('thumbnail').url
  }.property('thumbnail'),
  location: null,
  userFBId: null,
  fbPictureURL: function(){
	return this.get('fbURL')+'/picture';
  }.property('userFBId'),
  fbURL: function(){
	return 'http://graph.facebook.com/'+this.get('userFBId');
  }.property('userFBId'),
  user: null,
  userName: null,
  progress: 0,
  style: null,
  isUploading: false,
  isHidden: false,
  updateProgressBar: function(){
    var width = (this.get('progress')/100)*$('#file_list li:first').width();
    console.log('width: '+width);
    this.set('style', 'width: '+width+'px;');
  },
});



Swyp.documentController = Ember.ArrayProxy.create({
  content: [],

  parseHeaders: {"X-Parse-Application-Id": "q3FiX8q6K5ajET6MFdRwSh2icYgS93TiH5jaqOpb",
                "X-Parse-REST-API-Key": "xSn6JPXgyQTRtj1Y29jylJqQoo6zTVFzhaOz0RHy"},

  addDocument: function(doc){
    if (!this.get('content').findProperty('objectId', doc.objectId)){
      this.pushObject(doc);
    }
  },
  removeDocument: function(doc){
    this.removeObject(doc);
  },

  getUser: function(objectID){
    var that = this;
    $.ajax({
      url: "https://api.parse.com/1/users/"+objectID,
      headers:that.get('parseHeaders'),
      dataType: 'json',

      success: function(data){
        var results = data;
        console.log(results);
      },
      error: function(e){
        console.log('error');
      }
    });
  },

  populate: function(){

    var uri='{"location": {"$nearSphere":{"__type":"GeoPoint", "latitude":'+lati+', "longitude":'+longi+'}}}';
    var enur = encodeURIComponent(uri);
    var params = "limit="+ 10 +"&where="+enur;
    
    $.ajax({
      url: "https://api.parse.com/1/classes/RoomObject?"+params, 
      headers: Swyp.documentController.get('parseHeaders'),
      dataType: 'json',

      success: function(data){
        var results = data.results;
        console.log(results);
        results.forEach(function(result){
          console.log('another result '+result);
		  var doc = Swyp.Document.create(result);
          Swyp.documentController.addDocument(doc);
		  $.getJSON(doc.get('fbURL'), function(data){
			if(data.name){
				doc.set('userName', data.name);
			} else {
				console.log(data);
			}
		  });
		  
        });
      },
      error: function(e){
        console.log(e);
      }
    });
  },

  findDocuments: function(query){
    console.log(query);
    this.get('content').forEach(function(doc){
      var fname = doc.get('fileName').split(' ').join('').toLowerCase();
      console.log(fname);
      if(_.str.include(fname,query)){
        doc.set('isHidden', false);
      } else {
        doc.set('isHidden', true);
      }
    });
  }
});


$(document).ready(function(){
  initialize();

  function stopProp(e){
      e.stopPropagation();
      e.preventDefault();

      if($('#uploader').is(':hidden')){
        $('#uploader').slideDown();
      }
    }

  function removeDragOver(e){
    stopProp(e);
    $('#uploader').removeClass('dragover');
  }

  function uploadFile(f){
    var xhr = new XMLHttpRequest();
    var vFD = new FormData($('#uploader')[0]);

    var doc = Swyp.Document.create({file:f, isUploading:true, user: Tree.user});
    Swyp.documentController.addDocument(doc);

    xhr.upload.file = f;
    xhr.upload.loaded = 0;
    vFD.append('file', f); // 'file could be anything'

    console.log(f.name, f.type, f.size);

    xhr.upload.addEventListener('progress', function(e){
      if (e.lengthComputable){
        var percentage = Math.round((e.loaded * 100) / e.total);
        doc.set('progress', percentage);
        doc.updateProgressBar();
      }
    }, false);

    xhr.upload.addEventListener('load', function(e){
      console.log(e);
      console.log('done uploading');
    }, false);

    xhr.upload.addEventListener('error', function(e){
      console.log(e);
      Swyp.errorView.set('errors', [{message:e.status}]);
    }, false);

    xhr.onreadystatechange = function(){
      if (xhr.readyState != 4){ return; }
      if (xhr.status != 200){
        Swyp.errorView.set('errors', 
            [{name:'Unexpected error: '+xhr.status}]);

        Swyp.documentController.removeDocument(doc);
        return false;
      }

      var res = JSON.parse(xhr.responseText);

      console.log(res);
      if (res.errors){
        console.log('there are errors');
        Swyp.errorView.set('errors', res.errors);
        Swyp.documentController.removeDocument(doc);
      }

      doc.set('isUploading', false);
      doc.set('id', res.id);
      doc.set('url', res.url);
      doc.set('hash', res.hash);
    }

    xhr.open('post', '/upload', true);
    xhr.send(vFD);
  }

  function handleFile(e){
    removeDragOver(e);

    console.log(e);
    var files = e.target.files ?
      e.target.files : e.dataTransfer.files;

    for (var i = 0, f; f = files[i]; i++) {
      if (f.size > 1024*1024*50){
        Swyp.errorView.set('errors', [{name: f.name+' is too large. The max upload size is 50MB'}]);
        continue;
      }
  
      var filter = /^(image.*|.*pdf)$/i;
      if (!filter.test(f.type)){
        Swyp.errorView.set('errors', [{name:f.name+' is a '+f.type+' file. Only images and pdfs are supported for now.'}]);
        continue;
      }

      uploadFile(f);
    }
  }

  var refreshData = setInterval(Swyp.documentController.populate, 3000);

});


var map;



  function initialize() {
        var myOptions = {
    zoom: 17,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  map = new google.maps.Map(document.getElementById('map_canvas'),
      myOptions);


  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = new google.maps.LatLng(position.coords.latitude,
                                       position.coords.longitude);

      longi=pos.Oa;
      lati=pos.Pa;

      Swyp.documentController.populate();

      var dmark = new google.maps.Marker({
        map: map,
        position: pos
      });

      map.setCenter(pos);
    }, function() {
      handleNoGeolocation(true);
    });
  } else {
    // Browser doesn't support Geolocation
    handleNoGeolocation(false);
  }

        var input = document.getElementById('searchTextField');
        var autocomplete = new google.maps.places.Autocomplete(input);

        autocomplete.bindTo('bounds', map);

        var infowindow = new google.maps.InfoWindow();
        

        google.maps.event.addListener(autocomplete, 'place_changed', function() {
          infowindow.close();
		  
          var place = autocomplete.getPlace();
         
          map.setCenter(place.geometry.location);
          map.setZoom(17);  // Why 17? Because it looks good.
		  
		  longi=place.geometry.location.longitude;
		  
		  lati=place.geometry.location.latitude;
		  
		  Swyp.documentController.set("content",[]);
		  Swyp.documentController.populate();
          

          var dmark = new google.maps.Marker({
			map: map,
			position: place.geometry.location
		});

          var address = '';
          if (place.address_components) {
            address = [(place.address_components[0] &&
                        place.address_components[0].short_name || ''),
                       (place.address_components[1] &&
                        place.address_components[1].short_name || ''),
                       (place.address_components[2] &&
                        place.address_components[2].short_name || '')
                      ].join(' ');
          }

          infowindow.setContent('<div><strong>' + place.name + '</strong><br>' + address);
          infowindow.open(map, marker);
        });


function handleNoGeolocation(errorFlag) {
  if (errorFlag) {
    var content = 'Error: The Geolocation service failed.';
  } else {
    var content = 'Error: Your browser doesn\'t support geolocation.';
  }

  var options = {
    map: map,
    position: new google.maps.LatLng(60, 105),
    content: content
  };

  var infowindow = new google.maps.InfoWindow(options);
  map.setCenter(options.position);
}

}

