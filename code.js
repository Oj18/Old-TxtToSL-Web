let progressKey = undefined;
let status = undefined;
let online = false;

let server = 'https://api.txttosl.com';

let updateSnackbar = undefined;
let newWorker = undefined;

function formatDate(date) {
  const year = date.getFullYear();
  let month = date.getMonth() + 1;
  month = month < 10 ? '0' + month : month;
  let day = date.getDate();
  day = day < 10 ? '0' + day : day;

  let hours = date.getHours();
  hours = hours < 10 ? '0' + hours : hours;
  let minutes = date.getMinutes();
  minutes = minutes < 10 ? '0' + minutes : minutes;

  return [year, month, day].join('-') + ' ' + [hours, minutes].join(':');
}

function formSubmit() {
  if (online && progressKey !== undefined) { translate(); }

  return false;
}

function getStatus() {
  $.get(server + '/api/v1/version', function (data) {
    const fulls = data.split('\n');
    let output = '';

    let sectionCount = 0;
    for (let i = 0; i < fulls.length; i++) {
      const split = fulls[i].split(';');

      if (split.length !== 2) {
        output += '<br/><hr>';

        sectionCount++;
      } else {
        output += split[0] + ': <b>' + split[1].substring(1) + '</b><br/>';
      }
    }

    output = output.replace(/[0-9]{13}/g, function(m) { return formatDate(new Date(parseInt(m))); });

    status = output;

    $('#status').html(output);

    $('#statusHeader').text(`Server Status (as of ${formatDate(new Date()).substring(5).replace('-', '/')})`);
  });
}

function heartbeatCheck() {
  if (window.navigator.onLine) { // if ($.get('https://api.txttosl.com/api/v1/heartbeat', function (data) {
    online = true;

    if (progressKey === undefined) {
      getProgressKey();
    }

    if (status === undefined) {
      getStatus();
    }

    updateUI();
  } else { // }).fail(function() {
    online = false;

    updateUI();
  } // });
}

function updateUI() {
  if (online) {
    $('#offlineStatus').fadeOut(500, function() {
      $('#onlineStatus').css('display', 'flex');
      $('#onlineStatus').fadeIn(500, function() {
        $('#translateButton').fadeIn(500);
      });
    });
  } else {
    $('#translateButton').fadeOut(500, function() {
      $('#onlineStatus').fadeOut(500, function() {
        $('#offlineStatus').fadeIn(500);
      });
    });
  }
}

function getProgressKey() {
  $.get(server + '/api/v1/progress/key', { prefix: 'TTSLWebApp' }, function (data) {
    progressKey = data;
    $('#progressKey').val(data);
  });
}

function load() {
  const aboutDialog = new mdc.dialog.MDCDialog(document.getElementById('about-dialog'));

  $('#about-button').click(function () {
    aboutDialog.open();
  });

  $('#about-close').click(function() {
    aboutDialog.close();
  });

  updateSnackbar = new mdc.snackbar.MDCSnackbar(document.getElementById('update-snackbar'));

  $('#update-button').click(function() {
    window.location.href = window.location.href;
  });

  window.mdc.autoInit();

  getStatus();
  heartbeatCheck();

  setInterval(heartbeatCheck, 1000); // setInterval(heartbeatCheck, 5000);
  setInterval(getStatus, 3600000);

  $('#main-form').submit(function(event) {
    return formSubmit();
	});

  $('#overall-speed-slider')[0].MDCSlider.listen('MDCSlider:input', function (detail) {
    const value = detail.detail.value;

    $('#overall-speed-actual').val(value);

    setSliderColor(value, '#overall-label');
  });

  $('#individual-speed-slider')[0].MDCSlider.listen('MDCSlider:input', function (detail) {
    const value = detail.detail.value;

    $('#individual-speed-actual').val(value);

    setSliderColor(value, '#individual-label');
  });

  $('#individual-speed-switch').change(function() {
    if (this.checked) {
      $('#individual-speed-slider')[0].MDCSlider.disabled = false;

      $('#individual-speed-actual').val($('#individual-speed-slider')[0].MDCSlider.value);
    } else {
      $('#individual-speed-slider')[0].MDCSlider.disabled = true;

      $('#individual-speed-actual').val(100);
    }
  });

  $(document).resize(function() {
    updateUI();
  });

  loadIndividualSpeed();
  registerSW();
}

async function registerSW() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '') {
    return false; // Disallow registering service worker on localhost
  }

  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for (let i = 0; i < registrations.length; i++) {
          if (registrations[i].active.scriptURL !== 'https://app.txttosl.com/sw.js') {
            registrations[i].unregister().then(function(success) {
              //updateSnackbar.open();
            });
          }
        }
      });

      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          newWorker = reg.installing;

          newWorker.addEventListener('statechange', () => {
            switch (newWorker.state) {
              case 'installed':
                if (navigator.serviceWorker.controller) {
                  updateSnackbar.open();
                }

                break;
            }
          });
        });
      });
    } catch(e) {
      console.log('SW registration failed')
    }
  }
}

function setSliderColor(value, selector) {
  if (value < 100) {
    const colorValue = ((value - 50) * 4);

    $(selector).css('color', 'rgb(255, ' + colorValue + ', ' + colorValue + ')');
  } else {
    $(selector).css('color', 'rgba(255, 255, 255, .87)');
  }
}

function loadIndividualSpeed() {
  if ($('#individual-speed-switch')[0].checked) {
    $('#individual-speed-slider')[0].MDCSlider.disabled = false;

    $('#individual-speed-actual').val($('#individual-speed-slider')[0].MDCSlider.value);
  } else {
    $('#individual-speed-slider')[0].MDCSlider.disabled = true;

    $('#individual-speed-actual').val(100);
  }
}

let timeElapsed = 0;

function timeFormat(time) {
  const milli = time * 10;

  const secs = (milli / 1000).toFixed(2);

  return secs;
}

function timeLoadingText() {
  const seconds = timeFormat(timeElapsed);
  $('.loadingTime').html(seconds + 's');

  timeElapsed++;

  setTimeout(timeLoadingText, 10);
}

function setPercentDone(percent) {
  $('.mdc-linear-progress')[0].MDCLinearProgress.foundation_.setProgress(percent / 100);
}

let eventSourceOkay = false;

function setupEventSource() {
  const evtSource = new EventSource(server + '/api/v1/progress/stream?progressKey=' + progressKey);

  evtSource.onmessage = function(event) {
    eventSourceOkay = true;

    const msg = event.data;
    const thirdOfFive = 1.66666666667;

    if (msg.indexOf('Uploaded to:') === -1) {
      $('#loadingText').text(msg);
    } else {
      $('#loadingText').text('Redirecting...');

      setPercentDone(100);
    }

    //document.getElementById('details-text').scrollTop = document.getElementById('details-text').scrollHeight;

    if (msg === 'Checking integrity of data directories...') {
      setPercentDone(0);
    }

    if (msg === 'Loading autoskips...') {
      setPercentDone(thirdOfFive);
    }

    if (msg === 'Loading phrases...') {
      setPercentDone(thirdOfFive * 2);
    }

    if (msg === 'Loading synonyms...') {
      setPercentDone(thirdOfFive * 3);
    }

    if (msg === 'Interpreting...') {
      setPercentDone(10);
    }

    if (msg.indexOf('Getting word') !== -1) {
      setPercentDone(20);
    }

    if (msg.indexOf('Generating overlay') !== -1) {
      setPercentDone(40);
    }

    if (msg.indexOf('Rendering') !== -1) {
      setPercentDone(60 + (parseInt(msg.split('%')[0].slice(-3)) / 5));
    }

    if (msg === 'Compressing...') {
      setPercentDone(80);
    }

    if (msg === 'Uploading...' || msg === 'Redirecting...') {
      setPercentDone(95);
    }
  }
}

function translate() {
  $('.main').fadeOut(1000, function() {
    $('.loading').fadeIn(1000);
    $('.loadingTime').fadeIn(1000);

    timeElapsed = 0;
    timeLoadingText();
  });

  $.get(server + '/api/v1/translate', $('#main-form').serialize(), function(url) {
    location.href = url;
  });

	setupEventSource();
}

// Loading Screen Background JS
$(window).on('load', function() {
  function init() {

    lines.length = 0;

    for( var i = 0; i < initialLines; ++i )
      lines.push( new Line( starter ) );

    ctx.fillStyle = '#222';
    ctx.fillRect( 0, 0, w, h );

    ctx.lineCap = 'round';
  }

var c = document.getElementById('c');
var ctx = c.getContext('2d');

var w = c.width = window.innerWidth,
    h = c.height = window.innerHeight,

    minDist = 10,
    maxDist = 20,
    initialWidth = 10,
    maxLines = 50,
    initialLines = 4,
    speed = 2,

    lines = [],
    frame = 0,
    timeSinceLast = 0,

    dirs = [
   // straight x, y velocity
      [ 0, 1 ],
      [ 1, 0 ],
      [ 0, -1 ],
    	[ -1, 0 ],
   // diagonals, 0.7 = sin(PI/4) = cos(PI/4)
      [ .7, .7 ],
      [ .7, -.7 ],
      [ -.7, .7 ],
      [ -.7, -.7]
    ],
    starter = { // starting parent line, just a pseudo line

      x: w / 2,
      y: h / 2,
      vx: 0,
      vy: 0,
      width: initialWidth
    };
function getColor( x ) {

  return 'hsl( hue, 80%, 50% )'.replace(
  	'hue', x / w * 360 + frame
  );
}
function anim() {

  window.requestAnimationFrame( anim );

  ++frame;

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,.02)';
  ctx.fillRect( 0, 0, w, h );
  ctx.shadowBlur = .5;

  for( var i = 0; i < lines.length; ++i )

    if( lines[ i ].step() ) { // if true it's dead

      lines.splice( i, 1 );
      --i;

    }

  // spawn new

  ++timeSinceLast

  if( lines.length < maxLines && timeSinceLast > 10 && Math.random() < .5 ) {

    timeSinceLast = 0;

    lines.push( new Line( starter ) );

    // cover the middle;
    ctx.fillStyle = ctx.shadowColor = getColor( starter.x );
    ctx.beginPath();
    ctx.arc( starter.x, starter.y, initialWidth, 0, Math.PI * 2 );
    ctx.fill();
  }
}

function Line( parent ) {

  this.x = parent.x | 0;
  this.y = parent.y | 0;
  this.width = parent.width / 1.25;

  do {

    var dir = dirs[ ( Math.random() * dirs.length ) |0 ];
    this.vx = dir[ 0 ];
    this.vy = dir[ 1 ];

  } while (
    ( this.vx === -parent.vx && this.vy === -parent.vy ) || ( this.vx === parent.vx && this.vy === parent.vy) );

  this.vx *= speed;
  this.vy *= speed;

  this.dist = ( Math.random() * ( maxDist - minDist ) + minDist );

}
Line.prototype.step = function() {

  var dead = false;

  var prevX = this.x,
      prevY = this.y;

  this.x += this.vx;
  this.y += this.vy;

  --this.dist;

  // kill if out of screen
  if( this.x < 0 || this.x > w || this.y < 0 || this.y > h )
    dead = true;

  // make children :D
  if( this.dist <= 0 && this.width > 1 ) {

    // keep yo self, sometimes
    this.dist = Math.random() * ( maxDist - minDist ) + minDist;

    // add 2 children
    if( lines.length < maxLines ) lines.push( new Line( this ) );
    if( lines.length < maxLines && Math.random() < .5 ) lines.push( new Line( this ) );

    // kill the poor thing
    if( Math.random() < .2 ) dead = true;
  }

  ctx.strokeStyle = ctx.shadowColor = getColor( this.x );
  ctx.beginPath();
  ctx.lineWidth = this.width;
  ctx.moveTo( this.x, this.y );
  ctx.lineTo( prevX, prevY );
  ctx.stroke();

  if( dead ) return true
}

init();
anim();

window.addEventListener( 'resize', function() {
  w = c.width = window.innerWidth;
  h = c.height = window.innerHeight;
  starter.x = w / 2;
  starter.y = h / 2;

  init();
} )
});
