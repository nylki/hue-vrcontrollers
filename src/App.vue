
<template>
	
	<div id="app">
		<div id="connectStatus">
			<span>{{connectMessage}}</span>
		</div>
		
		
		<div id="connectBox" v-if="connectStatus !== 'connected'">
			
			<span>Enter your Bridge IP or hostname</span>
			
			<div id="bridgeForm">
				<input type="text" name="bridgeAddress" v-model="bridgeAddress">
				<button type="button" name="connectBridgeBtn" @click="connectBridge()">connect</button>
			</div>
			
			<span id="discoverBridgeLink" @click="discoverBridge()">
				Attempt automatic discovering
			</span>
			
		</div>
		
		<template v-if="connectStatus === 'connected'">
			
			<button type="button" name="resetBtn" @click="resetConfiguration($event)">reset</button><br>
			<button type="button" name="configureBtn" @click="toggleConfiguration($event)">{{configureLightMode ? 'done' : 'configure lights'}}</button>
			
			<div id="configureModal" v-if="configureLightMode">
				<div class="introduction">
					Hi! You are now in the setup mode. Please configure your lights now. <br>
					To do so:<br><br>
					1. go to the selected  light(<span style="color:red">red</span>), draw a circle around it while keeping the trigger pressed.<br>
					The light should turn yellow. Release when you finished drawing the circle, the light should turn green.
					2. Continue with the next unconfigured red light. You can selected
					
					
					
					
					Configure light positions below. Positions are saved locally in your browser for future sessions.
				</div>
				
				<div id="lightList">
					<template v-for="light in lights">
						<div class="lightListItem" :style="{backgroundColor:light.color}" @click="configureLight(light, $event)">
							<span>{{light.number}}</span>
							<span>{{light.name}}</span>
							<span>{{light.position}}</span>
						</div>
					</template>
				
			</div>
		</div>
			
			<button type="button" name="recalibrate" @click="startCalibrationMode()">recalibrate</button>
			
			
		</template>
		
		<a-scene embedded debug>
			<a-camera>
			</a-camera>
			
			
			
			<a-sky color="#dad6d6"></a-sky>
			<template v-for="light in configuredLights">
				<a-text :value="light.name" :position="light.position | stringPos"></a-text>
				<a-sphere class="lights" :number="light.number" :id="light.uuid" :radius="light.radius" :color="light.color" :position="light.position | stringPos" @mouseenter="hoverLight($event, light)"
				@mouseleave="hoverLight($event, light)"
				@click="toggleLight($event, light)"></a-sphere>
			</template>
			
			<a-entity id="rightHand" @axismove="axismove($event)" @triggerdown="triggerDown($event)" @triggerup.stop="triggerUp($event)" @trackpaddown="trackpadDown($event)" vive-controls="hand: right" controller-cursor>
			</a-entity>
			
			<a-entity id="leftHand" @axismove="axismove($event)" @triggerdown="triggerDown($event)" @triggerup.stop="triggerUp($event)" @trackpaddown="trackpadDown($event)" vive-controls="hand: left" controller-cursor>
			</a-entity>
			
			<a-plane color="rgb(119, 119, 119)" height="100" width="100" rotation="-90 0 0"></a-plane>
			
		</a-scene>
		
		
	</div>
</template>


<script>
// import AFRAME from 'aframe'; // doesn not allow embedded mode? so use script tag instead for now
import controllerCursor from 'aframe-controller-cursor-component';
AFRAME.registerComponent('aframe-controller-cursor-component', controllerCursor);
import jshue from './jshue.js';
import chroma from 'chroma-js';
import idbKeyval from 'idb-keyval';

const hue = jshue();
const SYNC_DELAY = 90; // Time between a sync call to the bridge for color changes
const RED = Math.round( chroma('#ff0000').hsv()[0] * (65535 / 360) );
const YELLOW = Math.round( chroma('#ffed00').hsv()[0] * (65535 / 360) );
const GREEN = Math.round( chroma('#33ff00').hsv()[0] * (65535 / 360) );


export default {
	name: 'app',
	data() {
		return {
			lights: [],
			configuredLights: [],
			calibrationLight: undefined,
			outlinePoints: [],
			hoveredLight: undefined,
			lastSync: new Date(),
			syncTimeout: null,
			firstStart: true,
			bridgeAddress: '',
			connectStatus: 'disconnected',
			collectPointsInterval: null,
			configureLightMode: false
		};
	},
	computed: {
		connectMessage: function () {
			if(this.connectStatus === 'disconnected') {
				return 'No bridges found. Try entering the address manually.';
			} else if(this.connectStatus === 'connected') {
				return `You are connected to bridge (${this.bridgeAddress})`;
			} else if (this.connectStatus === 'connecting') {
				return `Connecting to bridge @ ${this.bridgeAddress}, connecting…`;
			} else if (this.connectStatus === 'error') {
				return 'Error connecting to brige. Are you sure the IP-Address of your bridge is correct?';
			}
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
			this.connectStatus = 'connecting';
			return hue.discover().then(bridges => {
				console.log(bridges);
				if(bridges.length === 0) {
					console.log('No bridges found. :(');
					this.connectStatus = 'disconnected';
				}
				else {
					console.log('discovered a bridge!', bridges[0].internalipaddress);
					this.bridgeAddress = bridges[0].internalipaddress;
				}
			}).catch(e => {
				console.log('Error finding bridges', e);
			});
		},
		
		connectBridge: async function () {
			console.log('connectBridge');
			this.connectStatus = 'connecting';
			this.bridge = hue.bridge(this.bridgeAddress);
			this.hueUser = this.bridge.user('lampe-bash');
			let self = this;
			
			return new Promise(async (resolve, reject) => {
				
				let timeout = setTimeout(handleError, 5000);
				
				function handleError() {
					self.connectStatus = 'error';
					console.log('Error getting config from bridge');
					reject();
				}
				
				try {
					var config = await this.hueUser.getConfig();
					this.connectStatus = 'connected';
					idbKeyval.set('bridgeAddress', this.bridgeAddress);
					
					await this.pullLights();

					if(this.firstStart) {
						console.log('FIRST START');
						this.toggleConfiguration();
					} else {
						console.log('NOT FIRST');
						this.startCalibrationMode();
					}
					
					resolve();
				} catch (e) {
					console.log('catched error');
					console.log(e);
					handleError();
				} finally {
					clearTimeout(timeout);
				}
				
			});
			
		},
		
		resetConfiguration: function () {
			console.log('resetConfig');
			idbKeyval.delete('bridgeAddress');
			idbKeyval.delete('configuredLights');
			this.lights = [];
			this.configuredLights = [];
			this.calibrationLight = undefined;
			this.bridgeAddress = '';
			this.bridgeAddress = undefined;
			this.connectStatus = 'disconnected';
			this.firstStart = true;
			this.calibrationMode = false;
		},
		
		startCalibrationMode: function () {
			console.log('OK, IN CALIBRATION MODE!');
			this.calibrationMode = true;
			this.configureLight(this.calibrationLight);
		},
		
		repositionAllBasedOnCalibrationLight: function () {
			console.log('reposition!!');
			for (let light of this.configuredLights) {
				console.log('light:', light.number, 'is being repositioned.');
				if(light === this.calibrationLight) continue;
				light.position = new THREE.Vector3().subVectors(this.calibrationLight.position, light.relativePosition);
			}
			
		},
		
		pullLights: async function () {
			// Initially get all lights from indexedDB and Hue Bridge.
			
			let storedPromise = idbKeyval.get('configuredLights');
			let calibrationLightNumber = await idbKeyval.get('calibrationLightNumber');
			console.log('HELLO');
			
			let bridgePromise = this.hueUser.getLights();
			let [storedLights=[], bridgeLights] = await Promise.all([storedPromise, bridgePromise]);
			console.log(storedLights, bridgeLights);
			this.firstStart = storedLights.length === 0;
			if(Object.keys(bridgeLights).length === 0) {
				console.error('No lights found @ configured bridge!');
				return;
			}
			
			// Merge Bridge light info into position light info
			for (let index in bridgeLights) {
				
				let light = bridgeLights[index];
				let storedLight = storedLights.find((light_) => light.uniqueid === light_.uniqueid);
				
				if(storedLight) {
					light = Object.assign(light, storedLight);
					this.configuredLights.push(light);
				} else {
					light.color = 'white';
					light.position = {};
				}
				light.number = parseInt(index);
				this.lights.push(light);
				if(light.number === calibrationLightNumber) this.calibrationLight = light;

			}
			
			this.repositionAllBasedOnCalibrationLight();
			
		},
		syncLights: function () {
			console.log('sync lights');
			let promises = [];
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
			this.lastSync = new Date();
			for (let light of this.configuredLights) {
				console.log(light.changed, light.number);
				if(light.changed !== undefined && light.changed === true) {
					let p = this.hueUser.setLightState(light.number, {sat: 255, bri: light.state.bri, hue: light.state.hue, transitiontime: 0});
					p.catch(console.log);
					promises.push(p);
					light.changed = false;
				}
			}
			return Promise.all(promises);
			
		},
		
		queueSyncLights: function () {
			
			// Check if a timeout to sync is already scheduled, if there is wait for it
			// otherwise try to sync lights now or schedule a timeout for soonish execution
			// console.log('quue sync lights');
			if(!this.syncTimeout) {
				// console.log('no timeout');
				let now = new Date();
				let diff = now - this.lastSync;
				if(diff >= SYNC_DELAY) {
					// Only set light state if 100ms have passed since last sync with bridge
					this.syncLights();
				} else {
					// Last update was less than 100ms ago, create a  recursive timeout instead
					this.syncTimeout = setTimeout(this.syncLights.bind(this), SYNC_DELAY - diff);
				}
			}
			
			
		},
		
		toggleConfiguration: function (evt) {
			this.configureLightMode = !this.configureLightMode;
			if(this.configureLightMode) {
				this.configureLight(this.lights[0], evt);
			} else {
				this.repositionAllBasedOnCalibrationLight();
			}
		},
		
		
		configureLight: function (l, evt) {
			console.log(this);
			console.log('set up', l.number);
			this.lightToConfigure = l;
			
			let lightOffPromise = [];
			
			// Use scene 0 to change all at once
			for (let l of this.lights) {
				if(l.number === 7 || l.number === this.lightToConfigure.number) continue;
				l.previousState = Object.assign({}, l.state);
				l.color = 'white';
				lightOffPromise.push(this.hueUser.setLightState(l.number, {on: true, bri:0, sat:0}));
			}
			console.log('change ', this.lightToConfigure.number, 'to RED');
			this.lightToConfigure.color = 'red';
			
			// TODO: improve this!
			Promise.all(lightOffPromise).then(() => {

				this.hueUser.setLightState(this.lightToConfigure.number, {transitiontime: 1, hue: RED, sat:250, bri: 250, on: true});
			});
			
			
			console.log(this.lightToConfigure);
		},
		
		triggerDown: function (evt) {
			console.log(evt);
			console.log('controller click');
			
			// CHECK IF IT IS TRACKPAD CLICK
			
			if((this.configureLightMode || this.calibrationMode) && this.lightToConfigure !== undefined) {
				// Set the lights position to controllers position
				this.outlinePoints = new THREE.Geometry();
				this.collectPointsInterval = setInterval(() => {
					this.addPoint(evt.target);
				}, 50);
				
				this.hueUser.setLightState(this.lightToConfigure.number, {hue: YELLOW});
				this.queueSyncLights();
			}
		},
		triggerUp: function (evt) {
			console.log('triggerup');
			if((this.configureLightMode || this.calibrationMode) && this.lightToConfigure !== undefined && this.collectPointsInterval) {
				
				clearInterval(this.collectPointsInterval);
				console.log('collected points', this.outlinePoints);
				// calculate center of outline
				// let center = new THREE.Vector3(0, 0, 0);
				// for (let point of this.outlinePoints) {
				// 	center.add(point);
				// }
				// center.divideScalar(this.outlinePoints.length);
				// console.log(center);
				
				this.outlinePoints.computeBoundingSphere();
				console.log('center:', this.outlinePoints.boundingSphere.center);
				console.log('radius', this.outlinePoints.boundingSphere.radius);
				
				this.lightToConfigure.position = this.outlinePoints.boundingSphere.center;
				this.lightToConfigure.radius = this.outlinePoints.boundingSphere.radius * 1.2;
				// save relative position to the calibrationLight for later sessions
				// used when calling recalibrate
				
				
				
				if(this.configuredLights.length === 0) {
					// if it is the first light to be configured
					// use it as the calibration point for all additional lights
					console.log('FIRST CONFIGURED LIGHTS????');
					this.calibrationLight = this.lightToConfigure;
				}
				
				// If light has not been configured yet, add it to the configuredLights list
				if(!this.configuredLights.some(light => light.number === this.lightToConfigure.number)) {
					this.lightToConfigure.changed = false;
					this.configuredLights.push(this.lightToConfigure);
				}
				
				this.setRelativePosition(this.lightToConfigure);
				this.updateIDB();
				

				// configured! Make current light green for a moment, let it flash then restore
				//  all lights to their previous state
				//  TODO: instead of setting light state directly let it handle by the syncLights
				//  and diffing the changes there?
				this.hueUser.setLightState(this.lightToConfigure.number, {hue: GREEN, alert: 'select'}).then(() => {
					this.lights.forEach((light) => {
						if(light.previousState)
							this.hueUser.setLightState(light.number, light.previousState.on);
						// light.state = Object.assign({}, light.previousState);
					});
				});
				
				
				
				

				
				if (this.lightToConfigure === this.calibrationLight) {
					
					if(this.calibrationMode) {
						console.log('OK CALIBRATION FINISHED!');
						this.calibrationMode = false;
						this.repositionAllBasedOnCalibrationLight();
						return;
						
					} else {
						// Just set light 1 (calibration light) to new position
						// so we keep all other lights position but adjust their relative position
						// to calibration light.
						this.configuredLights.forEach(this.setRelativePosition);
					}
				}
				
				// Go to next light
				this.configureLight(this.lights[this.lightToConfigure.number + 1]);
			}
		},
		
		trackpadDown: function(evt, el) {
			let direction = evt.target.lastAxis[0] <= 0 ? 'left' : 'right';
			console.log('trackpad down:', direction);
			console.log('light length', this.lights.length);
			if(this.configureLightMode) {
				let nextLightNumber = this.lightToConfigure.number + (direction === 'left' ? -1 : 1) % this.lights.length;
				nextLightNumber = Math.max(nextLightNumber, 1);
				nextLightNumber = Math.min(nextLightNumber, this.lights.length - 1);
				console.log(this.lightToConfigure.number, '->', nextLightNumber);
				this.configureLight(this.lights[nextLightNumber-1]);
			}
		},
		
		addPoint: function (controller) {
			let {x, y, z} = controller.getAttribute('position');
			let controllerPos = new THREE.Vector3(x, y, z);
			let numPoints = this.outlinePoints.vertices.length;
			if(numPoints !== 0) {
				let dist = controllerPos.distanceTo(this.outlinePoints.vertices[numPoints-1]);
				// console.log('distance', dist);
				// dont add point if too close or too far away to previous point
				// to prevent overly large array, respectively flaky position info from the controller
				if(dist < 0.01 || dist > 1.0) return;
			}
			this.outlinePoints.vertices.push(controllerPos);
			// this.outlinePoints.push(controllerPos);
			// console.log(this.outlinePoints.vertices);
		},
		
		compressPoints: function () {
			
		},
		
		toggleLight: function (evt, light) {
			return this.hueUser.getLight(light.number).then(({state}) => {
				return this.hueUser.setLightState(light.number, {on: !state.on});
			});
		},
		axismove: function (evt) {
			
			// console.log(evt.detail.axis);
			// FIXME: for some reason there is always a 0,0 axis event triggered at the end
			// maybe open issue at aframe?
			if((evt.detail.axis[0] === 0 && evt.detail.axis[1] === 0)) return;
			let axis = evt.detail.axis;
			evt.target.lastAxis = axis;
			if(this.configureLightMode || this.calibrationMode) return;
			
			let vec = new THREE.Vector2(axis[0], axis[1]);
			let angle = vec.angle() * 180/Math.PI;
			// console.log(angle);
			let [h, s, v] = chroma.hsv(angle, 0.9, 0.9).hsv();
			
			let hsb = {hue: Math.round(h * (65535 / 360)), sat: Math.round(s * 255), bri: Math.round(v * 255)};
			
			if(this.hoveredLight) {
				// console.log(intersected);
				this.hoveredLight.state.hue = hsb.hue;
				// console.log('changed',intersected.number,'to',intersected.state.hue);
				this.hoveredLight.changed = true;
				// intersected.state.sat = hsb.sat;
				// intersected.state.bri = hsb.bri;
				
				this.queueSyncLights(); // IDEA: Perhaps move this to a watcher that watches this.configuredLights
			}
			
		},
		
		hoverLight: async function (evt, light) {
			
			if(this.configureLightMode || this.calibrationMode) return;
			// let state = await this.hueUser.getLight(light.number);
			// console.log(evt.type);
			if(evt.type === 'mouseenter') {
				console.log('mouseenter');
				this.hoveredLight = light;
				light.previousColor = {
					hue: light.state.bri,
					sat: light.state.sat,
					bri: light.state.bri
				};
				// Create subtle hover effect by dimming up/down
				light.state.bri = light.state.bri <= 200 ? light.state.bri + 50 : light.state.bri - 50;
				light.changed = true;
				
			} else if (evt.type === 'mouseleave') {
				console.log('mouseleave');
				this.hoveredLight = undefined;
				// Restore previous light if not changed.
				if(!light.changed) { //FIXME: changed is reset/false when light changes...
					light.state.bri = light.previousColor.bri;
					light.changed = true;
				}
			}
			
			this.syncLights();
			
		},
		
		setRelativePosition: function(light) {
			console.log(light);
			console.log(JSON.stringify(light.position));
			console.log(this.calibrationLight);
			console.log(JSON.stringify(this.calibrationLight.position));
			light.relativePosition = new THREE.Vector3().subVectors(this.calibrationLight.position, light.position);
			console.log(JSON.stringify(light.relativePosition));
		},
		
		updateIDB: function() {
			idbKeyval.set('calibrationLightNumber', this.calibrationLight.number);
			idbKeyval.set('configuredLights', this.configuredLights);
		}
	}
};

// function hueGammaCorrection(value) {
// 	return (value > 0.04045) ? Math.pow((value + 0.055) / (1.0 + 0.055), 2.4) : (value / 12.92);
// }
//
// function hueReverseGammaCorrection(value) {
// 	return (value <= 0.0031308) ? 12.92 * value : (1.0 + 0.055) * Math.pow(value, (1.0 / 2.4)) - 0.055;
// }
//
//
//
// function hueGlToXY(rgb) {
// 	rgb = rgb.map(hueGammaCorrection);
// 	let [r, g, b] = rgb;
// 	let x = r * 0.664511 + g * 0.154324 + b * 0.162028;
// 	let y = r * 0.283881 + g * 0.668433 + b * 0.047685;
// 	let z = r * 0.000088 + g * 0.072310 + b * 0.986039;
// 	x = x / (x + y + z);
// 	y = y / (x + y + z);
// 	return [x,y];
// }
//
// function hueXYtoGl([x, y]) {
// 	let z =  1.0 - x - y;
//
// 	let y_ = 1.0;//brightness
// 	let x_ = (y / y_) * x;
// 	let z_ = (y_ / y) * z;
//
// 	let r =  x_ * 1.656492 - y_ * 0.354851 - z_ * 0.255038;
// 	let g = -x_ * 0.707196 + y_ * 1.655397 + z_ * 0.036152;
// 	let b =  x_ * 0.051713 - y_ * 0.121364 + z_ * 1.011530;
//
// 	return [r, g, b].map(hueReverseGammaCorrection);
// }





function addIndex(light, index) {
	light.index = index;
	return light;
}
</script>

<style>
a-scene {
	width: 400px;
	height: 400px;
}
.hidden {
	display: none;
}


.error {
	background-color: rgba(249, 60, 65, 0.5);
}

#connectBox {
	width: 20em;
	display: flex;
	flex-direction: column;
}

#discoverBridgeLink {
	color: blue;
	cursor: pointer;
}

#bridgeForm {
	width: 10px;
	display: flex;
	flex-direction: row;
}

#lightList {
	display: flex;
	flex-direction: row;
}

.lightListItem {
	cursor: pointer;
	padding: 0.5em;
	margin: 0.25em;
	border: 1px solid black;
	
}

.lightListItem:hover {
	background-color: rgba(255, 0, 0, 0.25) !important;
}



</style>
