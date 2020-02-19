// Get config from URL
var config = (function() {
	var config = {};
	var q = window.location.search.substring(1);
	if (q === '') {
	  return config;
	}
	var params = q.split('&');
	var param, name, value;
	for (var i = 0; i < params.length; i++) {
	  param = params[i].split('=');
	  name = param[0];
	  value = param[1];
  
	  // All config values are either boolean or float
	  config[name] = value === 'true' ? true :
					 value === 'false' ? false :
					 parseFloat(value);
	}
	return config;
  })();
  
  var polyfill = new WebVRPolyfill(config);
  


  console.log("Using webvr-polyfill version " + WebVRPolyfill.version +
			  " with configuration: " + JSON.stringify(config));
  var renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(Math.floor(window.devicePixelRatio));
  
  // Append the canvas element created by the renderer to document body element.
  var canvas = renderer.domElement;
  document.body.appendChild(canvas);
  
  // Create a three.js scene.
  var scene = new THREE.Scene();
  
  // Create a three.js camera.
  var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  
  // Create a reticle
  var reticle = new THREE.Mesh(
	new THREE.RingBufferGeometry(0.005, 0.01, 15),
	new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  reticle.position.z = -0.5;
  camera.add(reticle);
  scene.add(camera);
  
  THREE.VREffect = function ( renderer, onError ) {

	var vrDisplay, vrDisplays;
	var eyeTranslationL = new THREE.Vector3();
	var eyeTranslationR = new THREE.Vector3();
	var renderRectL, renderRectR;
	var headMatrix = new THREE.Matrix4();
	var eyeMatrixL = new THREE.Matrix4();
	var eyeMatrixR = new THREE.Matrix4();

	var frameData = null;

	if ( 'VRFrameData' in window ) {

		frameData = new window.VRFrameData();

	}

	function gotVRDisplays( displays ) {

		vrDisplays = displays;

		if ( displays.length > 0 ) {

			vrDisplay = displays[ 0 ];

		} else {

			if ( onError ) onError( 'HMD not available' );

		}

	}

	if ( navigator.getVRDisplays ) {

		navigator.getVRDisplays().then( gotVRDisplays ).catch( function () {

			console.warn( 'THREE.VREffect: Unable to get VR Displays' );

		} );

	}

	//

	this.isPresenting = false;

	var scope = this;

	var rendererSize = renderer.getSize();
	var rendererUpdateStyle = false;
	var rendererPixelRatio = renderer.getPixelRatio();

	this.getVRDisplay = function () {

		return vrDisplay;

	};

	this.setVRDisplay = function ( value ) {

		vrDisplay = value;

	};

	this.getVRDisplays = function () {

		console.warn( 'THREE.VREffect: getVRDisplays() is being deprecated.' );
		return vrDisplays;

	};

	this.setSize = function ( width, height, updateStyle ) {

		rendererSize = { width: width, height: height };
		rendererUpdateStyle = updateStyle;

		if ( scope.isPresenting ) {

			var eyeParamsL = vrDisplay.getEyeParameters( 'left' );
			renderer.setPixelRatio( 1 );
			renderer.setSize( eyeParamsL.renderWidth * 2, eyeParamsL.renderHeight, false );

		} else {

			renderer.setPixelRatio( rendererPixelRatio );
			renderer.setSize( width, height, updateStyle );

		}

	};

	// VR presentation

	var canvas = renderer.domElement;
	var defaultLeftBounds = [ 0.0, 0.0, 0.5, 1.0 ];
	var defaultRightBounds = [ 0.5, 0.0, 0.5, 1.0 ];

	function onVRDisplayPresentChange() {

		var wasPresenting = scope.isPresenting;
		scope.isPresenting = vrDisplay !== undefined && vrDisplay.isPresenting;

		if ( scope.isPresenting ) {

			var eyeParamsL = vrDisplay.getEyeParameters( 'left' );
			var eyeWidth = eyeParamsL.renderWidth;
			var eyeHeight = eyeParamsL.renderHeight;

			if ( ! wasPresenting ) {

				rendererPixelRatio = renderer.getPixelRatio();
				rendererSize = renderer.getSize();

				renderer.setPixelRatio( 1 );
				renderer.setSize( eyeWidth * 2, eyeHeight, false );

			}

		} else if ( wasPresenting ) {

			renderer.setPixelRatio( rendererPixelRatio );
			renderer.setSize( rendererSize.width, rendererSize.height, rendererUpdateStyle );

		}

	}

	window.addEventListener( 'vrdisplaypresentchange', onVRDisplayPresentChange, false );

	this.setFullScreen = function ( boolean ) {

		return new Promise( function ( resolve, reject ) {

			if ( vrDisplay === undefined ) {

				reject( new Error( 'No VR hardware found.' ) );
				return;

			}

			if ( scope.isPresenting === boolean ) {

				resolve();
				return;

			}

			if ( boolean ) {

				resolve( vrDisplay.requestPresent( [ { source: canvas } ] ) );

			} else {

				resolve( vrDisplay.exitPresent() );

			}

		} );

	};

	this.requestPresent = function () {

		return this.setFullScreen( true );

	};

	this.exitPresent = function () {

		return this.setFullScreen( false );

	};

	this.requestAnimationFrame = function ( f ) {

		if ( vrDisplay !== undefined ) {

			return vrDisplay.requestAnimationFrame( f );

		} else {

			return window.requestAnimationFrame( f );

		}

	};

	this.cancelAnimationFrame = function ( h ) {

		if ( vrDisplay !== undefined ) {

			vrDisplay.cancelAnimationFrame( h );

		} else {

			window.cancelAnimationFrame( h );

		}

	};

	this.submitFrame = function () {

		if ( vrDisplay !== undefined && scope.isPresenting ) {

			vrDisplay.submitFrame();

		}

	};

	this.autoSubmitFrame = true;

	// render

	var cameraL = new THREE.PerspectiveCamera();
	cameraL.layers.enable( 1 );

	var cameraR = new THREE.PerspectiveCamera();
	cameraR.layers.enable( 2 );

	this.render = function ( scene, camera, renderTarget, forceClear ) {

		if ( vrDisplay && scope.isPresenting ) {

			var autoUpdate = scene.autoUpdate;

			if ( autoUpdate ) {

				scene.updateMatrixWorld();
				scene.autoUpdate = false;

			}

			if ( Array.isArray( scene ) ) {

				console.warn( 'THREE.VREffect.render() no longer supports arrays. Use object.layers instead.' );
				scene = scene[ 0 ];

			}

			// When rendering we don't care what the recommended size is, only what the actual size
			// of the backbuffer is.
			var size = renderer.getSize();
			var layers = vrDisplay.getLayers();
			var leftBounds;
			var rightBounds;

			if ( layers.length ) {

				var layer = layers[ 0 ];

				leftBounds = layer.leftBounds !== null && layer.leftBounds.length === 4 ? layer.leftBounds : defaultLeftBounds;
				rightBounds = layer.rightBounds !== null && layer.rightBounds.length === 4 ? layer.rightBounds : defaultRightBounds;

			} else {

				leftBounds = defaultLeftBounds;
				rightBounds = defaultRightBounds;

			}

			renderRectL = {
				x: Math.round( size.width * leftBounds[ 0 ] ),
				y: Math.round( size.height * leftBounds[ 1 ] ),
				width: Math.round( size.width * leftBounds[ 2 ] ),
				height: Math.round( size.height * leftBounds[ 3 ] )
			};
			renderRectR = {
				x: Math.round( size.width * rightBounds[ 0 ] ),
				y: Math.round( size.height * rightBounds[ 1 ] ),
				width: Math.round( size.width * rightBounds[ 2 ] ),
				height: Math.round( size.height * rightBounds[ 3 ] )
			};

			if ( renderTarget ) {

				renderer.setRenderTarget( renderTarget );
				renderTarget.scissorTest = true;

			} else {

				renderer.setRenderTarget( null );
				renderer.setScissorTest( true );

			}

			if ( renderer.autoClear || forceClear ) renderer.clear();

			if ( camera.parent === null ) camera.updateMatrixWorld();

			camera.matrixWorld.decompose( cameraL.position, cameraL.quaternion, cameraL.scale );

			cameraR.position.copy( cameraL.position );
			cameraR.quaternion.copy( cameraL.quaternion );
			cameraR.scale.copy( cameraL.scale );

			if ( vrDisplay.getFrameData ) {

				vrDisplay.depthNear = camera.near;
				vrDisplay.depthFar = camera.far;

				vrDisplay.getFrameData( frameData );

				cameraL.projectionMatrix.elements = frameData.leftProjectionMatrix;
				cameraR.projectionMatrix.elements = frameData.rightProjectionMatrix;

				getEyeMatrices( frameData );

				cameraL.updateMatrix();
				cameraL.matrix.multiply( eyeMatrixL );
				cameraL.matrix.decompose( cameraL.position, cameraL.quaternion, cameraL.scale );

				cameraR.updateMatrix();
				cameraR.matrix.multiply( eyeMatrixR );
				cameraR.matrix.decompose( cameraR.position, cameraR.quaternion, cameraR.scale );

			} else {

				var eyeParamsL = vrDisplay.getEyeParameters( 'left' );
				var eyeParamsR = vrDisplay.getEyeParameters( 'right' );

				cameraL.projectionMatrix = fovToProjection( eyeParamsL.fieldOfView, true, camera.near, camera.far );
				cameraR.projectionMatrix = fovToProjection( eyeParamsR.fieldOfView, true, camera.near, camera.far );

				eyeTranslationL.fromArray( eyeParamsL.offset );
				eyeTranslationR.fromArray( eyeParamsR.offset );

				cameraL.translateOnAxis( eyeTranslationL, cameraL.scale.x );
				cameraR.translateOnAxis( eyeTranslationR, cameraR.scale.x );

			}

			// render left eye
			if ( renderTarget ) {

				renderTarget.viewport.set( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );
				renderTarget.scissor.set( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );

			} else {

				renderer.setViewport( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );
				renderer.setScissor( renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height );

			}
			renderer.render( scene, cameraL, renderTarget, forceClear );

			// render right eye
			if ( renderTarget ) {

				renderTarget.viewport.set( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );
				renderTarget.scissor.set( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );

			} else {

				renderer.setViewport( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );
				renderer.setScissor( renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height );

			}
			renderer.render( scene, cameraR, renderTarget, forceClear );

			if ( renderTarget ) {

				renderTarget.viewport.set( 0, 0, size.width, size.height );
				renderTarget.scissor.set( 0, 0, size.width, size.height );
				renderTarget.scissorTest = false;
				renderer.setRenderTarget( null );

			} else {

				renderer.setViewport( 0, 0, size.width, size.height );
				renderer.setScissorTest( false );

			}

			if ( autoUpdate ) {

				scene.autoUpdate = true;

			}

			if ( scope.autoSubmitFrame ) {

				scope.submitFrame();

			}

			return;

		}

		// Regular render mode if not HMD

		renderer.render( scene, camera, renderTarget, forceClear );

	};

	this.dispose = function () {

		window.removeEventListener( 'vrdisplaypresentchange', onVRDisplayPresentChange, false );

	};

	//

	var poseOrientation = new THREE.Quaternion();
	var posePosition = new THREE.Vector3();

	// Compute model matrices of the eyes with respect to the head.
	function getEyeMatrices( frameData ) {

		// Compute the matrix for the position of the head based on the pose
		if ( frameData.pose.orientation ) {

			poseOrientation.fromArray( frameData.pose.orientation );
			headMatrix.makeRotationFromQuaternion( poseOrientation );

		}	else {

			headMatrix.identity();

		}

		if ( frameData.pose.position ) {

			posePosition.fromArray( frameData.pose.position );
			headMatrix.setPosition( posePosition );

		}

		// The view matrix transforms vertices from sitting space to eye space. As such, the view matrix can be thought of as a product of two matrices:
		// headToEyeMatrix * sittingToHeadMatrix

		// The headMatrix that we've calculated above is the model matrix of the head in sitting space, which is the inverse of sittingToHeadMatrix.
		// So when we multiply the view matrix with headMatrix, we're left with headToEyeMatrix:
		// viewMatrix * headMatrix = headToEyeMatrix * sittingToHeadMatrix * headMatrix = headToEyeMatrix

		eyeMatrixL.fromArray( frameData.leftViewMatrix );
		eyeMatrixL.multiply( headMatrix );
		eyeMatrixR.fromArray( frameData.rightViewMatrix );
		eyeMatrixR.multiply( headMatrix );

		// The eye's model matrix in head space is the inverse of headToEyeMatrix we calculated above.

		eyeMatrixL.getInverse( eyeMatrixL );
		eyeMatrixR.getInverse( eyeMatrixR );

	}

	function fovToNDCScaleOffset( fov ) {

		var pxscale = 2.0 / ( fov.leftTan + fov.rightTan );
		var pxoffset = ( fov.leftTan - fov.rightTan ) * pxscale * 0.5;
		var pyscale = 2.0 / ( fov.upTan + fov.downTan );
		var pyoffset = ( fov.upTan - fov.downTan ) * pyscale * 0.5;
		return { scale: [ pxscale, pyscale ], offset: [ pxoffset, pyoffset ] };

	}

	function fovPortToProjection( fov, rightHanded, zNear, zFar ) {

		rightHanded = rightHanded === undefined ? true : rightHanded;
		zNear = zNear === undefined ? 0.01 : zNear;
		zFar = zFar === undefined ? 10000.0 : zFar;

		var handednessScale = rightHanded ? - 1.0 : 1.0;

		// start with an identity matrix
		var mobj = new THREE.Matrix4();
		var m = mobj.elements;

		// and with scale/offset info for normalized device coords
		var scaleAndOffset = fovToNDCScaleOffset( fov );

		// X result, map clip edges to [-w,+w]
		m[ 0 * 4 + 0 ] = scaleAndOffset.scale[ 0 ];
		m[ 0 * 4 + 1 ] = 0.0;
		m[ 0 * 4 + 2 ] = scaleAndOffset.offset[ 0 ] * handednessScale;
		m[ 0 * 4 + 3 ] = 0.0;

		// Y result, map clip edges to [-w,+w]
		// Y offset is negated because this proj matrix transforms from world coords with Y=up,
		// but the NDC scaling has Y=down (thanks D3D?)
		m[ 1 * 4 + 0 ] = 0.0;
		m[ 1 * 4 + 1 ] = scaleAndOffset.scale[ 1 ];
		m[ 1 * 4 + 2 ] = - scaleAndOffset.offset[ 1 ] * handednessScale;
		m[ 1 * 4 + 3 ] = 0.0;

		// Z result (up to the app)
		m[ 2 * 4 + 0 ] = 0.0;
		m[ 2 * 4 + 1 ] = 0.0;
		m[ 2 * 4 + 2 ] = zFar / ( zNear - zFar ) * - handednessScale;
		m[ 2 * 4 + 3 ] = ( zFar * zNear ) / ( zNear - zFar );

		// W result (= Z in)
		m[ 3 * 4 + 0 ] = 0.0;
		m[ 3 * 4 + 1 ] = 0.0;
		m[ 3 * 4 + 2 ] = handednessScale;
		m[ 3 * 4 + 3 ] = 0.0;

		mobj.transpose();
		return mobj;

	}

	function fovToProjection( fov, rightHanded, zNear, zFar ) {

		var DEG2RAD = Math.PI / 180.0;

		var fovPort = {
			upTan: Math.tan( fov.upDegrees * DEG2RAD ),
			downTan: Math.tan( fov.downDegrees * DEG2RAD ),
			leftTan: Math.tan( fov.leftDegrees * DEG2RAD ),
			rightTan: Math.tan( fov.rightDegrees * DEG2RAD )
		};

		return fovPortToProjection( fovPort, rightHanded, zNear, zFar );

	}

};

//   // Apply VR stereo rendering to renderer.
//   var effect = new THREE.VREffect(renderer);
//   effect.setSize(canvas.clientWidth, canvas.clientHeight, false);
  
//   var vrDisplay, controls;
  
//   // Add a repeating grid as a skybox.
//   var boxWidth = 5;
  
//   // Create 3D objects.
//   var geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
//   var material = new THREE.MeshNormalMaterial();
//   var cube = new THREE.Mesh(geometry, material);
  
//   // Position cube
//   cube.position.z = -1;
  
//   // Add cube mesh to your three.js scene
//   scene.add(cube);
  
//   // Load the skybox texture and cube
//   var loader = new THREE.TextureLoader();
//   loader.load('img/box.png', onTextureLoaded);
//   function onTextureLoaded(texture) {
// 	texture.wrapS = THREE.RepeatWrapping;
// 	texture.wrapT = THREE.RepeatWrapping;
// 	texture.repeat.set(boxWidth, boxWidth);
// 	var geometry = new THREE.BoxGeometry(boxWidth, boxWidth, boxWidth);
// 	var material = new THREE.MeshBasicMaterial({
// 	  map: texture,
// 	  color: 0x01BE00,
// 	  side: THREE.BackSide
// 	});
// 	var skybox = new THREE.Mesh(geometry, material);
// 	scene.add(skybox);
//   }
  
//   // The polyfill provides this in the event this browser
//   // does not support WebVR 1.1
//   navigator.getVRDisplays().then(function (vrDisplays) {
// 	// If we have a native display, or we have a CardboardVRDisplay
// 	// from the polyfill, use it
// 	if (vrDisplays.length) {
// 	  vrDisplay = vrDisplays[0];
  
// 	  // Apply VR headset positional data to camera.
// 	  controls = new THREE.VRControls(camera);
  
// 	  // Kick off the render loop.
// 	  vrDisplay.requestAnimationFrame(animate);
// 	}
// 	// Otherwise, we're on a desktop environment with no native
// 	// displays, so provide controls for a monoscopic desktop view
// 	else {
// 	  controls = new THREE.OrbitControls(camera);
// 	  controls.target.set(0, 0, -1);
  
// 	  // Disable the "Enter VR" button
// 	  var enterVRButton = document.querySelector('#vr');
// 	  enterVRButton.disabled = true;
  
// 	  // Kick off the render loop.
// 	  requestAnimationFrame(animate);
// 	}
//   });
  
//   // Request animation frame loop function
//   var lastRender = 0;
//   function animate(timestamp) {
// 	var delta = Math.min(timestamp - lastRender, 500);
// 	lastRender = timestamp;
  
// 	// Apply rotation to cube mesh
// 	cube.rotation.y += delta * 0.0002;
  
// 	// Update VR headset position and apply to camera.
// 	controls.update();
  
// 	// Render the scene.
// 	effect.render(scene, camera);
  
// 	// Keep looping; if using a VRDisplay, call its requestAnimationFrame,
// 	// otherwise call window.requestAnimationFrame.
// 	if (vrDisplay) {
// 	  vrDisplay.requestAnimationFrame(animate);
// 	} else {
// 	  requestAnimationFrame(animate);
// 	}
//   }
  
//   function onResize() {
// 	// The delay ensures the browser has a chance to layout
// 	// the page and update the clientWidth/clientHeight.
// 	// This problem particularly crops up under iOS.
// 	if (!onResize.resizeDelay) {
// 	  onResize.resizeDelay = setTimeout(function () {
// 		onResize.resizeDelay = null;
// 		console.log('Resizing to %s x %s.', canvas.clientWidth, canvas.clientHeight);
// 		effect.setSize(canvas.clientWidth, canvas.clientHeight, false);
// 		camera.aspect = canvas.clientWidth / canvas.clientHeight;
// 		camera.updateProjectionMatrix();
// 	  }, 250);
// 	}
//   }
  
//   function onVRDisplayPresentChange() {
// 	console.log('onVRDisplayPresentChange');
// 	onResize();
// 	buttons.hidden = vrDisplay.isPresenting;
//   }
  
//   function onVRDisplayConnect(e) {
// 	console.log('onVRDisplayConnect', (e.display || (e.detail && e.detail.display)));
//   }
  
//   // Resize the WebGL canvas when we resize and also when we change modes.
//   window.addEventListener('resize', onResize);
//   window.addEventListener('vrdisplaypresentchange', onVRDisplayPresentChange);
//   window.addEventListener('vrdisplayconnect', onVRDisplayConnect);
  
//   // Button click handlers.
//   document.querySelector('button#fullscreen').addEventListener('click', function() {
// 	enterFullscreen(renderer.domElement);
//   });
//   document.querySelector('button#vr').addEventListener('click', function() {
// 	vrDisplay.requestPresent([{source: renderer.domElement}]);
//   });
  
//   function enterFullscreen (el) {
// 	if (el.requestFullscreen) {
// 	  el.requestFullscreen();
// 	} else if (el.mozRequestFullScreen) {
// 	  el.mozRequestFullScreen();
// 	} else if (el.webkitRequestFullscreen) {
// 	  el.webkitRequestFullscreen();
// 	} else if (el.msRequestFullscreen) {
// 	  el.msRequestFullscreen();
// 	}
//   }
  