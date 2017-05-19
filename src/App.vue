
<template>

	<div id="app">
		<span class="error" v-if="!bridgeConnected">{{bridgeError}}</span><br>
		
		<div class="" v-if="manualBridgeSetup">
			<span>Enter your Bridge IP manually:</span>
			<input type="text" name="bridgeAddress" v-model="bridgeAddress">
			<button type="button" name="connectBridgeBtn" v-on:click="connectBridge()">connect</button>
		</div>
		<div class="" v-else>
			<span>Connected with bridge at {{bridgeAddress}}</span>
			<button type="button" name="button">reset</button>
		</div>
		
		<template v-if="bridgeConnected">
			<div class="introduction">
				Configure light positions below. Positions are saved locally in your browser for future sessions.
			</div>
			<button type="button" name="resetAll" v-on:click="resetConfiguration($event)"></button>
			<div class="lightList">
				<template v-for="light in lights">
					<span>{{light.number}}</span>
					<span :style="{backgroundColor:light.color}">{{light.name}}</span><span>{{light.position}}</span><span>{{light.color}}</span><button type="button" v-on:click="configureLight($event, light)">position with controller</button>
					<br><br>
				</template>
			</div>
			
			
			
		</template>
		<a-scene embedded debug>
			<a-camera>
			</a-camera>
			
			
			
			<a-sky color="#ECECEC"></a-sky>
			<template v-for="light in configuredLights">
				<a-text :value="light.name" :position="light.position | stringPos"></a-text>
				<a-sphere class="lights" :number="light.number" :id="light.uuid" radius="0.5" :color="light.color" :position="light.position | stringPos" v-on:mouseenter="hoverLight($event, light)"
				v-on:mouseleave="hoverLight($event, light)"
				v-on:click="toggleLight($event, light)"></a-sphere>
			</template>
			
			<a-entity id="rightHand" v-on:axismove="axismove($event)" v-on:buttonup="controllerClick($event)" hand-controls="right" controller-cursor>
			</a-entity>
			
			<a-entity id="leftHand" v-on:axismove="axismove($event)" v-on:buttonup="controllerClick($event)" hand-controls="left" controller-cursor>
			</a-entity>
			
			<a-plane color="rgb(119, 119, 119)" height="100" width="100" rotation="-90 0 0"></a-plane>
			
		</a-scene>
		
		
	</div>
</template>


<script>

import jsHue from './jshue';
import chroma from 'chroma-js';
import idbKeyval from 'idb-keyval';

const hue = jsHue();

export default {
	name: 'app',
	data() {
		return {
			lights: [],
			configuredLights: [],
			lastSync: new Date(),
			syncTimeout: null,
			manualBridgeSetup: false,
			bridgeAddress: '',
			bridgeConnected: false,
			bridgeError: ''
		}
	},
	watch: {
		
	},
	filters: {
		stringPos: ({x, y, z}) => `${x} ${y} ${z}`
	},
	

	created: async function () {

		// TODO: use saved bridge IP if it exists.
		let bridgeAddress = await idbKeyval.get('bridgeAddress');
		console.log(bridgeAddress);
		if(bridgeAddress !== undefined) {
			this.bridgeAddress = bridgeAddress;
			this.connectBridge();

		} else {
			return this.discoverBridge();
		}
	},
	
	
	methods: {
	discoverBridge: function () {
		return hue.discover().then(bridges => {
				if(bridges.length === 0) {
						console.log('No bridges found. :(');
						this.bridgeError = 'No bridges found. Try entering the address manually.';
						this.manualBridgeSetup = true;
				}
				else {
					this.bridgeAddress = bridges[0].internalipaddress;
					return this.connectBridge();
				}
		}).catch(e => {
			this.manualBridgeSetup = true;
			console.log('Error finding bridges', e)
		});
	},
	
	connectBridge: function () {
		this.bridge = hue.bridge(this.bridgeAddress);
		this.hueUser = this.bridge.user('lampe-bash');
			return this.hueUser.getConfig()
			.then(config => {
				console.log(config);
				this.bridgeConnected = true;
				idbKeyval.set('bridgeAddress', this.bridgeAddress);
				return this.pullLights();
			})
			.catch((err) => {
				console.log('Error getting config from bridge');
				console.log(err);
				this.bridgeError = 'Error connecting to brige. Are you sure the IP-Address of your bridge is correct?';
			})
		},
		
		resetConfiguration: function () {
			idbKeyval.delete('configuredLights');
		},
		
		pullLights: async function () {
			// Initially get all lights from indexedDB and Hue Bridge.
			
			let storedPromise = idbKeyval.get('configuredLights');
			let bridgePromise = this.hueUser.getLights();
			let [storedLights=[], bridgeLights] = await Promise.all([storedPromise, bridgePromise]);
			console.log(storedLights, bridgeLights);
			if(Object.keys(bridgeLights).length === 0) {
				console.error('No lights found @ configured bridge!');
			}
			
			// Merge Bridge light info into position light info
			for (let index in bridgeLights) {
				
				let light = bridgeLights[index];
				let storedLight = storedLights.find((light_) => light.uniqueid === light_.uniqueid);
				
				if(storedLight) {
					light = Object.assign(light, storedLight);
					this.configuredLights.push(light);
				} else {
					light.position = {};
				}
				light.number = parseInt(index);
				this.lights.push(light);
			}

		},
		syncLights: function () {
			console.log('sync timeout');
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
			this.lastSync = new Date();
			for (let light of this.configuredLights) {
				if(!light.changed) continue; // don't change light state for non-changed lights
				return this.hueUser.setLightState(light.number, {hue: light.state.hue}).catch((err) => {
					console.log(err);
				})
				light.changed = false;
			}
			
		},
		
		queueSyncLights: function () {
			
			// Check if a timeout to sync is already scheduled, if there is wait for it
			// otherwise try to sync lights now or schedule a timeout for soonish execution
			// console.log('quue sync lights');
			if(!this.syncTimeout) {
				// console.log('no timeout');
				let now = new Date();
				let diff = now - this.lastSync;
				if(diff >= 1000) {
					console.log('ok sync now!');
					// Only set light state if 100ms have passed since last sync with bridge
					this.syncLights();
				} else {
					// Last update was less than 100ms ago, create a  recursive timeout instead
					this.syncTimeout = setTimeout(this.syncLights.bind(this), 1000 - diff);
				}
			}
			
			
		},
		
		
    configureLight: function (evt, light) {
			console.log('set up', light);
			this.configureLightMode = true;
			this.lightToConfigure = light;
			console.log(this.lightToConfigure);
		},

		controllerClick: function (evt) {
			console.log('controller click');

			if(this.configureLightMode && this.lightToConfigure !== undefined) {
				// Set the lights position to controllers position
				this.lightToConfigure.position = evt.target.getAttribute('position');
				
				// If light has not been configured yet, add it to the configuredLights list
				if(!this.configuredLights.some(light => light.number === this.lightToConfigure.number)) {
					this.lightToConfigure.changed = false;
					this.configuredLights.push(this.lightToConfigure);
				}
				
				console.log('configured lights');
				idbKeyval.set('configuredLights', this.configuredLights);
				this.configureLightMode = false;
				this.lightToConfigure = undefined;
			}
		},

		toggleLight: function (evt, light) {
			return this.hueUser.getLight(light.number).then(({state}) => {
				return this.hueUser.setLightState(light.number, {on: !state.on});
			})
		},
		axismove: function (evt, el) {
			// console.log(evt.detail.axis);
			// FIXME: for some reason there is always a 0,0 axis event triggered at the end
			// maybe open issue at aframe?
			if(evt.detail.axis[0] === 0 && evt.detail.axis[1] === 0) return;
			let axis = evt.detail.axis;
			let vec = new THREE.Vector2(axis[0], axis[1]);
			let angle = vec.angle() * 180/Math.PI;
			// console.log(angle);
			let [h, s, v] = chroma.hsv(angle, 0.9, 0.9).hsv();
			
			let hsb = {hue: Math.round(h * (65535 / 360)), sat: Math.round(s * 255), bri: Math.round(v * 255)};
			
			let selected = evt.detail.target.components.raycaster.intersectedEls;

			if(selected.length !== 0) {

				let intersected = this.configuredLights.find(({number}) => {
					return number === parseInt(selected[0].getAttribute('number'))
				});
				
				// console.log(intersected);
				intersected.state.hue = hsb.hue;
				// console.log('changed',intersected.number,'to',intersected.state.hue);
				intersected.changed = true;
				// intersected.state.sat = hsb.sat;
				// intersected.state.bri = hsb.bri;

				this.queueSyncLights(); // IDEA: Perhaps move this to a watcher that watches this.configuredLights
			}

		},

		hoverLight: async function (evt, light) {
			console.log('hover light');
			
			// let state = await this.hueUser.getLight(light.number);
				// console.log(evt.type);
				if(evt.type === 'mouseenter') {
					
					light.previousColor = {
						hue: light.state.bri,
						sat: light.state.sat,
						bri: light.state.bri
					}
					// Create subtle hover effect by dimming up/down
					light.state.bri = light.state.bri <= 245 ? light.state.bri + 10 : light.state.bri - 10;
					
				} else if (evt.type === 'mouseleave') {
					// Restore previous light if not changed.
					if(!light.changed) {
						light.state.bri = light.previousColor.bri;
					}
				}
				this.queueSyncLights();

		}
  }
}


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

function hueReverseGammaCorrection(value) {
	return (value <= 0.0031308) ? 12.92 * value : (1.0 + 0.055) * Math.pow(value, (1.0 / 2.4)) - 0.055;
}



function hueGlToXY(rgb) {
	rgb = rgb.map(hueGammaCorrection);
	let [r, g, b] = rgb;
	let x = r * 0.664511 + g * 0.154324 + b * 0.162028;
	let y = r * 0.283881 + g * 0.668433 + b * 0.047685;
	let z = r * 0.000088 + g * 0.072310 + b * 0.986039;
	x = x / (x + y + z);
	y = y / (x + y + z);
	return [x,y];
}

function hueXYtoGl([x, y]) {
	let z =  1.0 - x - y;
	
	let y_ = 1.0;//brightness
	let x_ = (y / y_) * x;
	let z_ = (y_ / y) * z;
	
	let r =  x_ * 1.656492 - y_ * 0.354851 - z_ * 0.255038;
	let g = -x_ * 0.707196 + y_ * 1.655397 + z_ * 0.036152;
	let b =  x_ * 0.051713 - y_ * 0.121364 + z_ * 1.011530;

	return [r, g, b].map(hueReverseGammaCorrection);
}





function addIndex(light, index) {
	light.index = index;
	return light;
}
</script>

<style>
a-scene {
	width: 500px;
	height: 500px;
}
.hidden {
	display: none;
}

#lightlist {
	display: flex;
	flex-direction: column;
}

.error {
	background-color: rgba(249, 60, 65, 0.5);
}
</style>