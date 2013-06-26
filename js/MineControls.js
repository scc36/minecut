/**
 * @author 
 *
 *  Originally based off the Orbit Control, but now changed to enable better camera position
 */

THREE.MineControls = function ( object, domElement ) {
	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	
	// Settings
	this.enabled = true;
	
	//  user actions
	this.userZoom = true;
	this.userZoomSpeed = 1.0;
	
	this.userRotate = true;
	this.userRotateSpeed = 1.0;
	
	this.userPan = true;
	this.userPanHeight = true;
	this.userPanSpeed = 1.0;
	this.userPanMod = 0.0007;	// How much pan is effected by zoom
	
	this.keyRotate = 20.0;
	this.objectRotate = 0.005;
	
	//  camera limits
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI * 0.55; // radians
	
	this.minDistance = 0;
	this.maxDistance = 2000;
	
	// internals
	var scope = this;
	
	var EPS = 0.000001;
	var PIXELS_PER_ROUND = 1800;
	
	var objectStart = new THREE.Vector2();
	var objectEnd = new THREE.Vector2();
	var objectDelta = new THREE.Vector2();
	
	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();
	
	var zoomStart = new THREE.Vector2();
	var zoomEnd = new THREE.Vector2();
	var zoomDelta = new THREE.Vector2();
	
	var mousePos = new THREE.Vector2();
	
	//  camera info
	var phi = 0;	// angle from y-axis
	var phiDelta = 0;
	var theta = 0;	// angle from z-axis around y-axis
	var thetaDelta = 0;
	var radius = 0;	// distance between camera and focus
	var scale = 1;
	
	// Camera points to a "focus"
	this.focus = new THREE.Vector3();
	var lastPosition = new THREE.Vector3();
	this.object.position.set( 0, 50, 0 );
	
	// Second focus for 
	this.viewBlock;	// extruded object for rotation
	this.objectViewY = -5000;
	
	// Mouse states are unique, but key states can be concurrent
	var STATES = {OBJECT: -1, NONE: 0, ROTATE: 1, ZOOM: 3, PAN: 4};
	var mouseState = STATES.NONE;	// State is set from outside
	var keyState = { panUp: 0, panDown: 0, panLeft: 0, panRight: 0,
						zoomIn: 0, zoomOut: 0, heightUp: 0, heightDown: 0,
						turnUp: 0, turnDown: 0, turnLeft: 0, turnRight: 0};
	var mouseDown = false;	// for mouse downs
	var mouseClick = false;	// for mouse clicks
	
	// Events
	this.rotateG = function ( angle ) {
		thetaDelta -= angle;
	};

	this.rotateH = function ( angle ) {
		phiDelta -= angle;
	};
	
	this.zoomIn = function ( zoomScale ) {
		if ( zoomScale === undefined ) {
			zoomScale = scope.getZoomScale();
		}
		scale /= zoomScale;
	};
	
	this.zoomOut = function ( zoomScale ) {
		if ( zoomScale === undefined ) {
			zoomScale = scope.getZoomScale();
		}
		scale *= zoomScale;
	};
	
	this.pan = function ( distance ) {
		// Resolve difference between actual Three.js xyz and Math xyz
		distance = new THREE.Vector3(distance.x, distance.z, -distance.y);
		
		// Modify xy change based on ground angle
		newX = distance.x * Math.cos( theta ) + distance.z * Math.sin( theta );
		newZ = distance.z * Math.cos( theta ) - distance.x * Math.sin( theta );
		distance.x = newX;
		distance.z = newZ;
		
		// Increase speed with -zoom
		distance.multiplyScalar( this.userPanSpeed * radius * this.userPanMod );
		
		this.object.position.add( distance );
		this.focus.add( distance );
	};
	
	this.rotateObject = function (x, y) {
		this.viewBlock.rotation.z -= 2 * Math.PI * x * this.objectRotate;
		this.viewBlock.rotation.x += 2 * Math.PI * y * this.objectRotate;
	}
	
	// Update
	this.update = function () {
		// Ignore keystates if viewing the object
		if (mouseState > STATES.OBJECT) {
			// Update key events below
			if ( keyState.panLeft || keyState.panRight || keyState.panUp || keyState.panDown ||
					keyState.heightUp || keyState.heightDown) {
				scope.pan( new THREE.Vector3( (keyState.panRight - keyState.panLeft),
												(keyState.panUp - keyState.panDown),
												(keyState.heightUp - keyState.heightDown)) );
			}
			if (keyState.turnLeft || this.autoRotate) {
				scope.rotateG( this.keyRotate * Math.PI * keyState.turnLeft / PIXELS_PER_ROUND * scope.userRotateSpeed );
			}
			if (keyState.turnRight) {
				scope.rotateG( -this.keyRotate * Math.PI * keyState.turnRight / PIXELS_PER_ROUND * scope.userRotateSpeed );
			}
						
			// Update camera position/angle below
			var position = this.object.position;
			var offset = position.clone().sub( this.focus );
			
			// Calculate angles in line between camera and focus
			theta = Math.atan2( offset.x, offset.z );
			phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );
			
			theta += thetaDelta;
			phi += phiDelta;
			
			// restrict phi to be between desired limits + EPS and PI-EPS
			phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );
			phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );
			
			// Change camera distance based on zoom scale
			radius = offset.length() * scale;
			
			// restrict radius to be between desired limits
			radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );
			
			// Establish camera position
			offset.x = radius * Math.sin( phi ) * Math.sin( theta );
			offset.y = radius * Math.cos( phi );
			offset.z = radius * Math.sin( phi ) * Math.cos( theta );
			
			// Angle camera to look at focus
			position.copy( this.focus ).add( offset );
			this.object.lookAt( this.focus );
			
			thetaDelta = 0;
			phiDelta = 0;
			scale = 1;
		}
		else {
			radius *= scale;
			this.object.position = new THREE.Vector3(0, scope.objectViewY + radius, 0);
			this.object.rotation.x = Math.PI * -0.5;
			this.object.rotation.y = 0;
			this.object.rotation.z = 0;
		}
	};
	
	// Set and Get functions
	this.setState = function (state) {
		// Reset mouse properties
		mouseDown = false;
		
		if (mouseState === STATES.OBJECT && state !== "object") {
			this.object.position = lastPosition;
		}
		switch (state) {
			case "object":
				mouseState = STATES.OBJECT;
				lastPosition = this.object.position;
				break;
			case "rotate":
				mouseState = STATES.ROTATE;
				break;
			case "pan":
				mouseState = STATES.PAN;
				break;
			case "zoom":
				mouseState = STATES.ZOOM;
				break;
			default:
				mouseState = STATES.NONE;
		}
	}
	
	this.getMousePos = function () {
		return new THREE.Vector3 (mousePos.x, -mousePos.y, 0.5);
	}
	
	this.mouseClicked = function () {
		if (mouseClick && mouseState === STATES.NONE) {
			mouseClick = false;
			return true;
		}
		return false;
	}
	
	this.getZoomScale = function () {
		return Math.pow( 0.95, scope.userZoomSpeed );
	}
	
	// Declare event functions
	function onMouseDown( event ) {
		if ( scope.enabled === false ) return;
		
		event.preventDefault();
		
		if (mouseState === STATES.OBJECT) {
			objectStart.set( event.clientX, event.clientY );
		} else if (mouseState === STATES.ROTATE) {
			rotateStart.set( event.clientX, event.clientY );
		} else if (mouseState === STATES.ZOOM) {
			zoomStart.set( event.clientX, event.clientY );
		}
		
		mouseDown = true;
	}

	function onMouseMove( event ) {
		if ( scope.enabled === false ) return;
		
		event.preventDefault();
		
		mousePos.set ((event.clientX / window.innerWidth * 2) - 1, (event.clientY / window.innerHeight * 2) - 1);
		
		if (mouseDown) {
			if ( mouseState === STATES.OBJECT ) {
				objectEnd.set (event.clientX, event.clientY);
				objectDelta.subVectors( objectEnd, objectStart );
				scope.rotateObject( objectDelta.x, objectDelta.y )
				objectStart.copy (objectEnd);
			} else if ( mouseState === STATES.ROTATE ) {
				rotateEnd.set( event.clientX, event.clientY );
				rotateDelta.subVectors( rotateEnd, rotateStart );
				scope.rotateG (2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed);
				scope.rotateH (2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed);
				rotateStart.copy( rotateEnd );
			} else if ( mouseState === STATES.ZOOM ) {
				zoomEnd.set( event.clientX, event.clientY );
				zoomDelta.subVectors( zoomEnd, zoomStart );
				if ( zoomDelta.y > 0 ) {
					scope.zoomIn();
				} else {
					scope.zoomOut();
				}
				zoomStart.copy( zoomEnd );
			} else if ( mouseState === STATES.PAN ) {
				var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
				var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
				scope.pan( new THREE.Vector3( - movementX/5, movementY/5, 0 ) );
			}
		}
	}

	function onMouseUp( event ) {
		mouseClick = true;
		mouseDown = false;
	}
	
	function onMouseWheel( event ) {
		if ( scope.enabled === false ) return;
		if ( scope.userZoom === false ) return;
		var delta = 0;
		
		if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9
			delta = event.wheelDelta;
		} else if ( event.detail ) { // Firefox
			delta = - event.detail;
		}
		
		if ( delta > 0 ) {
			scope.zoomOut();
		} else {
			scope.zoomIn();
		}
	}
	
	function onKeyDown ( event ) {
		if ( event.altKey ) {
			return;
		}
		
		if ( scope.enabled === false ) return;
		if ( scope.userPan === false ) return;
		
		switch ( event.keyCode ) {
			case 16: /* shift */ this.movementSpeedMultiplier = .1; break;
			
			case 87: /*W*/
			case 38: /*up*/ keyState.panUp = 1; break;
			case 83: /*S*/
			case 40: /*down*/ keyState.panDown = 1; break;
			
			case 65: /*A*/
			case 37: /*left*/ keyState.panLeft = 1; break;
			case 68: /*D*/
			case 39: /*right*/ keyState.panRight = 1; break;
			
			case 82: /*R*/ keyState.heightUp = 1; break;
			case 70: /*F*/ keyState.heightDown = 1; break;
			
			case 81: /*Q*/ keyState.turnLeft = 1; break;
			case 69: /*E*/ keyState.turnRight = 1; break;
		}
	};

	function onKeyUp ( event ) {
		switch( event.keyCode ) {
			case 16: /* shift */ this.movementSpeedMultiplier = 1; break;
			
			case 87: /*W*/
			case 38: /*up*/ keyState.panUp = 0; break;
			case 83: /*S*/
			case 40: /*down*/ keyState.panDown = 0; break;
			
			case 65: /*A*/
			case 37: /*left*/ keyState.panLeft = 0; break;
			case 68: /*D*/
			case 39: /*right*/ keyState.panRight = 0; break;
			
			case 82: /*R*/ keyState.heightUp = 0; break;
			case 70: /*F*/ keyState.heightDown = 0; break;
			
			case 81: /*Q*/ keyState.turnLeft = 0; break;
			case 69: /*E*/ keyState.turnRight = 0; break;
		}
	};
	
	this.handleResize = function () {
	};
	
	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
	this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
	this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
	// Parent app also needs mousedown to find intersection points with the mouse
	this.domElement.addEventListener( 'mousedown', onMouseDown, false );
	this.domElement.addEventListener( 'mousemove', onMouseMove, false );
	this.domElement.addEventListener( 'mouseup', onMouseUp, false );
	
	// Key events are global
	document.addEventListener( 'keydown', onKeyDown, false );
	document.addEventListener( 'keyup', onKeyUp, false );
};

THREE.MineControls.prototype = Object.create( THREE.EventDispatcher.prototype );