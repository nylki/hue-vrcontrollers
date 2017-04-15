// import Vue from 'vuuu';
import jsHue from './jshue';
import Vue from 'vue';
var lightList = document.getElementById('lightlist');

var hue = jsHue();
var bridge = hue.bridge('192.168.1.17');
var user = bridge.user('lampe-bash');

let app = new Vue({
  el: '#app',
  data: {
    lights: [],
		foo: 'bar'
  },
  methods: {

  }
})


// Starts the setup in which the user can place virtual lights
// in his room with the VR controllers.
function startLightSetup() {

}

// 
// function init() {
// 	user.getConfig().then(config => {console.log(config)}).catch((err) => {console.log(err);})
// 	app.foo = 'blub';
// 	user.getLights().then((_lights) => {
// 		if(Object.keys(_lights).length === 0) {
// 			console.error('No lights found!');
// 		}
// 		console.log(_lights);
// 		// app.lights = _lights;
//
// 	})
// }

init();
setTimeout(() => {
	startLightSetup()
}, 10000);
