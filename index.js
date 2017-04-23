import jsHue from './jshue';
import Vue from 'vue';
import chroma from 'chroma-js';

var lightList = document.getElementById('lightlist');

var hue = jsHue();
var bridge = hue.bridge('192.168.1.17');
var user = bridge.user('lampe-bash');

let app = new Vue({
  el: '#app',
  data: {
    lights: [
			{uuid: '12949233A', number: 5, position: {x: 3, y: 2, z: 1}, name: 'unterwegs', color:"brown"},
			{uuid: '1294923B', number: 6, position: {x: 1, y: 3, z: -1}, name: 'test', color:"brown"}
		],
		foo: 'bar'
  },
	watch: {

	},
	filters: {
		stringPos: ({x, y, z}) => `${x} ${y} ${z}`
	},
  methods: {
    togglePosition: function (evt, light) {
			
		},
		
		toggleLight: function (evt, light) {
			return user.getLight(light.number).then(({state}) => {
				return user.setLightState(light.number, {on: !state.on});
			})
		},
		axismove: function (evt, el) {
			// console.log(evt.detail.axis);
			let axis = evt.detail.axis;
			let vec = new THREE.Vector2(axis[0], axis[1]);
			let angle = vec.angle() * 180/Math.PI;
			// console.log(angle);
			let color = chroma.hsv(angle, 0.9, 0.9).hex();
			let selected = evt.detail.target.components.raycaster.intersectedEls;
			if(selected.length !== 0) {
				console.log(selected);
				console.log(selected[0].getAttribute('number'));
				let intersected = this.lights.filter(({number}) => {
					return number === parseInt(selected[0].getAttribute('number'))
				})[0];

				intersected.color = color;
			}
			
			// 		// console.log(res);
		},
		
		hoverLight: function (evt, light) {
			// console.log(e);
			// console.log(e);
			// console.log(e.detail.els);
			console.log('\n\n\n');
			console.log(evt);
			console.log(light);
			light.color = light.color === 'fuchsia' ? 'blue' : 'fuchsia';
				// user.setLightState(light.number, {alert: 'select'}).then((res) => {
				// 	// console.log(res);
				// })
			// console.log(e.detail);
			// console.log(this.lights);
			// let el = e.detail.el || e.detail.els[0];
			// console.log(el.components);
			// let number_ = e.detail.target.getAttribute('number');
			// console.log(this.lights.filter(({number}) => number === number_));
			// // // console.log(el);
			// // // console.log(el);
			// // setTimeout(() => {
			// // 	let glColor = el.components.material.material.color;
			// // 	glColor = [glColor.r, glColor.g, glColor.b];
			// // 	glColor.forEach(hueGammaCorrection);
			// // 	let xy = hueGlToXY(glColor);
			// // 	console.log(xy);
			//
			// 	user.setLightState(el.getAttribute('number'),{alert: 'select'}).then((res) => {
			// 		// console.log(res);
			// 	})

		}
  }
})


// Starts the setup in which the user can place virtual lights
// in his room with the VR controllers.
function startLightSetup() {

}

function pointDown(e) {
  console.log(e);
}

function hueGammaCorrection(value) {
	return (value > 0.04045) ? Math.pow((value + 0.055) / (1.0 + 0.055), 2.4) : (value / 12.92);
}

function hueGlToXY([r, g, b]) {
	let X = r * 0.664511 + g * 0.154324 + b * 0.162028;
	let Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
	let Z = r * 0.000088 + g * 0.072310 + b * 0.986039;
	let x = X / (X + Y + Z);
	let y = Y / (X + Y + Z);
	return [x,y];
}

function handleHover(e) {


}

//
function init() {
	user.getConfig().then(config => {console.log(config)}).catch((err) => {console.log(err);})
	app.foo = 'blub';
	user.getLights().then((_lights) => {
		if(Object.keys(_lights).length === 0) {
			console.error('No lights found!');
		}
		console.log(_lights);
		let leftHand = document.getElementById('leftHand');
		let rightHand = document.getElementById('rightHand');
		console.log(leftHand, rightHand);
		let raycaster = document.getElementById('raycaster');
		// console.log(raycaster);
		// setInterval(() => {
		// 	console.log(raycaster.components.raycaster.intersectedEls);
		// }, 1000);
		// raycaster.addEventListener('raycaster-intersection', handleHover);
		// raycaster.addEventListener('raycaster-intersection-cleared', handleHover);

		// leftHand.addEventListener('gripdown', function (e) {
		// 	user.setLightState(5, { on: false }).then(data => {});
		// });
		//
		// leftHand.addEventListener('axismove', function (e) {
		// 	console.log(e);
		// });
		//
		// leftHand.addEventListener('gripup', function (e) {
		// 	user.setLightState(5, { on: true }).then(data => {
		// 	});
		// });
		
		rightHand.addEventListener('gripdown', function (e) {
    // process response data, do other things
			});

	});

		// app.lights = _lights;

}

init();
// setTimeout(() => {
// 	startLightSetup()
// }, 10000);
