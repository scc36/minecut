/**
 * @author 
 *
 *  Based heavily off the Orbit Control, with shifted keys and additional settings
 */

THREE.MapControls = function ( object, domElement ) {
	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;
	
	// Settings
	this.enabled = true;
	
	this.userZoom = true;
	this.userZoomSpeed = 1.0;
	
	this.userRotate = true;
	this.userRotateSpeed = 1.0;
	
	this.userPan = true;
	this.userPanHeight = true;
	this.userPanSpeed = 2.0;
	
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI * 0.55; // radians
	
	this.minDistance = 0;
	this.maxDistance = Infinity;
	
	this.rightMouseRotate = true;
	this.leftMouseRotate = false;
	this.edgeScrolling = true;
	this.edgeSize = 10;
	
	var startHeight = 50;
	this.object.position.set( 0, startHeight, 0 );
	
	// internals
	var scope = this;

	var EPS = 0.000001;
	var PIXELS_PER_ROUND = 1800;
	
	this.focus = new THREE.Vector3();
	
	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();
	
	var zoomStart = new THREE.Vector2();
	var zoomEnd = new THREE.Vector2();
	var zoomDelta = new THREE.Vector2();
	
	//var phiDelta = 0.05 * Math.PI;
	var phiDelta = 0;
	var thetaDelta = 0;
	var scale = 1;
	
	var lastPosition = new THREE.Vector3();

	// Mouse states are independant, but key states can be concurrent
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };
	var STATES = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
	var mouseState = STATES.NONE;
	var keyState = { panUp: 0, panDown: 0, panLeft: 0, panRight: 0,
						zoomIn: 0, zoomOut: 0, heightUp: 0, heightDown: 0,
						turnUp: 0, turnDown: 0, turnLeft: 0, turnRight: 0};
	this.mouseStatus = 0;

	// events

	var changeEvent = { type: 'change' };

	this.rotateLeft = function ( angle ) {
		if ( angle === undefined ) {
			angle = getAutoRotationAngle();
		}
		thetaDelta -= angle;
	};

	this.rotateRight = function ( angle ) {
		if ( angle === undefined ) {
			angle = getAutoRotationAngle();
		}
		thetaDelta += angle;
	};

	this.rotateUp = function ( angle ) {
		if ( angle === undefined ) {
			angle = getAutoRotationAngle();
		}
		phiDelta -= angle;
	};

	this.rotateDown = function ( angle ) {
		if ( angle === undefined ) {
			angle = getAutoRotationAngle();
		}
		phiDelta += angle;
	};

	this.zoomIn = function ( zoomScale ) {
		if ( zoomScale === undefined ) {
			zoomScale = getZoomScale();
		}
		scale /= zoomScale;
	};

	this.zoomOut = function ( zoomScale ) {
		if ( zoomScale === undefined ) {
			zoomScale = getZoomScale();
		}
		scale *= zoomScale;
	};

	this.pan = function ( distance ) {
		distance.transformDirection( this.object.matrix );
		distance.multiplyScalar( scope.userPanSpeed );
		
		this.object.position.add( distance );
		this.focus.add( distance );
	};

	this.update = function () {
		// Update Key Events
		if ( keyState.panLeft || keyState.panRight || keyState.panUp || keyState.panDown ||
				keyState.heightUp || keyState.heightDown) {
			scope.pan( new THREE.Vector3( (keyState.panRight - keyState.panLeft),
											(keyState.panUp - keyState.panDown),
											(keyState.heightUp - keyState.heightDown)) );
		}
		if ( keyState.turnLeft ) {
			scope.rotateLeft( 20 * Math.PI * keyState.turnLeft / PIXELS_PER_ROUND * scope.userRotateSpeed );
		}
		if ( keyState.turnRight ) {
			scope.rotateRight( 20 * Math.PI * keyState.turnRight / PIXELS_PER_ROUND * scope.userRotateSpeed );
		}
		
		var position = this.object.position;
		var offset = position.clone().sub( this.focus );
		
		// angle from z-axis around y-axis
		var theta = Math.atan2( offset.x, offset.z );
		
		// angle from y-axis
		var phi = Math.atan2( Math.sqrt( offset.x * offset.x + offset.z * offset.z ), offset.y );
		
		if ( this.autoRotate ) {
			this.rotateLeft( getAutoRotationAngle() );
		}
		
		theta += thetaDelta;
		phi += phiDelta;
		
		// restrict phi to be between desired limits
		phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, phi ) );
		
		// restrict phi to be betwee EPS and PI-EPS
		phi = Math.max( EPS, Math.min( Math.PI - EPS, phi ) );
		
		var radius = offset.length() * scale;
		
		// restrict radius to be between desired limits
		radius = Math.max( this.minDistance, Math.min( this.maxDistance, radius ) );
		
		offset.x = radius * Math.sin( phi ) * Math.sin( theta );
		offset.y = radius * Math.cos( phi );
		offset.z = radius * Math.sin( phi ) * Math.cos( theta );
		
		position.copy( this.focus ).add( offset );
		this.object.lookAt( this.focus );
		
		thetaDelta = 0;
		phiDelta = 0;
		scale = 1;
		
		if ( lastPosition.distanceTo( this.object.position ) > 0 ) {
			this.dispatchEvent( changeEvent );
			lastPosition.copy( this.object.position );
		}
	};

	function getAutoRotationAngle() {
		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
	}

	function getZoomScale() {
		return Math.pow( 0.95, scope.userZoomSpeed );
	}

	function onMouseDown( event ) {
		if ( scope.enabled === false ) return;
		if ( scope.userRotate === false ) return;
		
		event.preventDefault();
		
		if ( event.button === 0 ) {
			mouseState = STATES.ROTATE;
			rotateStart.set( event.clientX, event.clientY );
		} else if ( event.button === 1 ) {
			mouseState = STATES.ZOOM;
			zoomStart.set( event.clientX, event.clientY );
		} else if ( event.button === 2 ) {
			mouseState = STATES.PAN;
		}
		
		document.addEventListener( 'mousemove', onMouseMove, false );
		document.addEventListener( 'mouseup', onMouseUp, false );
	}

	function onMouseMove( event ) {
		if ( scope.enabled === false ) return;
		
		event.preventDefault();
		
		if ( mouseState === STATES.ROTATE ) {
			rotateEnd.set( event.clientX, event.clientY );
			rotateDelta.subVectors( rotateEnd, rotateStart );
			scope.rotateLeft( 2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed );
			scope.rotateUp( 2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed );
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
			scope.pan( new THREE.Vector3( - movementX, movementY, 0 ) );
		}
	}

	function onMouseUp( event ) {

		if ( scope.enabled === false ) return;
		if ( scope.userRotate === false ) return;

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		mouseState = STATES.NONE;

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
		//this.updateMovementVector();
		//this.updateRotationVector();
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
		//this.updateMovementVector();
		//this.updateRotationVector();
	};
	
	this.handleResize = function () {
	};
	
	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );
	this.domElement.addEventListener( 'mousedown', onMouseDown, false );
	this.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
	this.domElement.addEventListener( 'DOMMouseScroll', onMouseWheel, false ); // firefox
	
	// Keyevents are global
	document.addEventListener( 'keydown', onKeyDown, false );
	document.addEventListener( 'keyup', onKeyUp, false );
};

THREE.MapControls.prototype = Object.create( THREE.EventDispatcher.prototype );