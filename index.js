import jsHue from './jshue';
import Vue from 'vue';
import chroma from 'chroma-js';

const hue = jsHue();


let app = new Vue({
  el: '#app',
  data: {
		lights: [
			// {name: 'unterwegs', number: 5, position: {x: 1, y:2, z:5}, color:'red'}
		]
  },
	watch: {

	},
	filters: {
		stringPos: ({x, y, z}) => `${x} ${y} ${z}`
	},
	
	created: function () {
		
		this.bridge = hue.bridge('192.168.1.17');
		this.hueUser = this.bridge.user('lampe-bash');
		this.hueUser.getConfig()
		.then(config => {console.log(config)})
		.catch((err) => {console.log(err);})

		this.hueUser.getLights().then((lights_) => {
			if(Object.keys(lights_).length === 0) {
				console.error('No lights found!');
			}
			// Transform object coming from hue bridge to proper array
			// and save index/light number for later reference
			for (let index in lights_) {
				let light = lights_[index];
				light.number = parseInt(index);
				light.color = 'blue';
				light.position = {x:0, y:0, z:0}
				this.lights.push(light);
			}
			console.log(JSON.stringify(this.lights));
			
		});
	},
	
  methods: {
		
    setupLight: function (evt, light) {
			console.log('set up', light);
			this.setupLightMode = true;
			this.lightToSetup = light;
			console.log(this.lightToSetup);
		},
		
		controllerClick: function (evt) {
			console.log('controller click');

			if(this.setupLightMode && this.lightToSetup) {
				console.log(evt.target.getAttribute('position'));
				// Set the lights position to controllers position
				this.lightToSetup.position = evt.target.getAttribute('position');
				this.setupLightMode = false;
				this.lightToSetup = undefined;
			}
		},
		
		toggleLight: function (evt, light) {
			return this.hueUser.getLight(light.number).then(({state}) => {
				return this.hueUser.setLightState(light.number, {on: !state.on});
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
			
		},
		
		hoverLight: function (evt, light) {
			console.log('hover light');
			light.color = light.color === 'fuchsia' ? 'blue' : 'fuchsia';
				if(evt.type === 'mouseenter') {
					this.hueUser.setLightState(light.number, {alert: 'select'});
				}

		}
  }
})


// Starts the setup in which the hueUser can place virtual lights
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

function addIndex(light, index) {
	light.index = index;
	return light;
}
