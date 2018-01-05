'use strict';

/*
 * Hello there and welcome!
 * 
 * The purpose of this JS file is to spruce up my CV a bit.
 * Primarily I made it because I wanted some very subtle but nice 
 * effects in my CV, and have always been wanting to learn a 
 * bit more about OpenGL/WebGL. Maybe it also shows a bit
 * of my personality - who knows :)
 * 
 * It's not minified/uglified etc because I felt it would be
 * a good place to reach you - a fellow developer? - in
 * a different place than just textually :)
 * 
 * This project is structured (or rather it's not), in this
 * (single file, using functions to scope) way to minimize the 
 * use of frameworks (at least runtime) because I felt it is easier 
 * to understand the priniciples this way. Again, maybe it is
 * indicative of the way I think.
 * 
 * In a production project, where other developers work and
 * clients depend on us to maintain it, I believe I
 * should/would structure the code differently.
 * 
 * Ask me in person, if you want to know more about how I
 * would have done just that :)
 * 
 * Also: bear in mind - it was written in 2017. A lot changes
 * in JS...
 */
window.onload = init;

function init() {
  initDetachedHeader();
  initBouncingSkyline();
};

function initDetachedHeader() {
  var header = document.getElementsByTagName('header')[0];
  var stats = document.getElementById('stats');

  function detachHeader() {
    if (window.scrollY) {
      header.setAttribute('class', 'header__detached');
    } else {
      header.setAttribute('class', '');
    }
  }

  detachHeader();
  window.addEventListener('scroll', detachHeader);
}

/*
 * Below you'll find the code for the 'skyline' bounce effect at the
 * end of the CV. Strictly speaking it is a physical simulation
 * of boxes falling through a vacuum, all handled by the shader.
 * Most of the code below is just boiler plate WebGL stuff.
 * See the GitHub page for the vertics shader: https://github.com/freekh/freekh.github.io
 * 
 * Although, the shader could be optimized further, I am 
 * pretty happy with it and the results. Especially considering it is the first 
 * time I've been playing around with shaders and since it behaves 
 * exactly as *I* _imagined_/hoped it would.
 * 
 * Also: do not copy this without asking for permission. Reach out
 * so we can have a chat instead! You reach me through the issues on 
 * the github page: https://github.com/freekh/freekh.github.io
 */

function initBouncingSkyline() {
  var canvas = document.getElementById('canvas');
  var gl = canvas.getContext('webgl');

  if (!gl) {
    console.error('This browser does not have a context I can draw cool stuff in. No worries tho');
    return;
  }

  var scene = initScene(gl);
  scene.draw(); // draw first time

  var stopped = true;
  function iterate() {
    scene.iterateTime();
    scene.draw();
    if (!stopped) {
      requestAnimationFrame(iterate);
    }
  }

  function bounceOnScroll() {
    // should be supported by most browsers
    var scrolledToBottom = document.body.scrollHeight === window.scrollY + window.innerHeight;
    var scrolledAboveCanvas = document.body.scrollHeight - (window.scrollY + window.innerHeight) > canvas.scrollHeight;
    if (scrolledToBottom) {
      // bounce every time client scrolls to the bottom

      // we just reset, though it would be cool to reset the ones that where touching the ground
      // alas, I didn't feel like spending any more time on this
      scene.reset();
      if (stopped) {
        stopped = false;
        iterate();
      }
    } else if (scrolledAboveCanvas) {
      // stop drawing if we can't see it
      stopped = true;
      scene.reset();
      scene.draw();
    }
  }

  window.addEventListener('scroll', bounceOnScroll);
};

function rect(originX, originY, width, height) {
  // z is always height - required to know when to bounce
  return [originX, originY, height, originX + width, originY, height, originX + width, originY + height, height, originX + width, originY + height, height, originX, originY + height, height, originX, originY, height];
}

function createSkylineRects() {
  var amount = 100; // one per unit;
  // Array.map might not always be supported, but
  // most browsers that does not support it, will 
  // probably have issues with the rest of the shader in any case.
  // Since this is a purely visual effect, it's OK if it fails.
  // In this instance, I'd rather it fail than having a large
  // (and slow) polyfill  :)
  return new Array(amount).fill().map(function (_, i) {
    // I would say my style is more functional like this normally
    var height = Math.round(Math.random() * 30 + 30); // must be within 0-100, other numbers are just random
    return rect(i, 0, 1, height);
  });
}

function asFloat32Array(rects) {
  var trianglesPerRect = 3 * 6;

  // Not sure if Float32Array.from is supported everywhere
  var positions = new Float32Array(rects.length * trianglesPerRect);

  for (var i = 0; i < rects.length; i++) {
    for (var j = 0; j < trianglesPerRect; j++) {
      positions[i * trianglesPerRect + j] = rects[i][j];
    }
  }
  return positions;
}

function initScene(gl) {
  var time = 0;

  function reset() {
    time = 0;
  }

  function iterateTime() {
    time += 0.1; // random, ends up looking nice with current constants
  }

  var vertexShader = createShader(gl, gl.VERTEX_SHADER, 'attribute vec3 a_position;\nuniform float u_time;\n\nconst float g = 9.81; // Could be whatevs really\nconst float bouncyness = 0.5;\nconst int maxBounces = 20;\n\n// This could be improved with scaling ratios but I am happy enough already\nvec2 clipSpace(vec2 position) {\n  return ((position / (100.0 / 2.0)) - 1.0) * vec2(1.0, -1.0);\n}\n\nvoid main() {\n  float yMax = 100. - a_position.z;\n  float t = u_time;\n  float t0 = 2.0 * sqrt(yMax / g);\n  float T = 0.;\n\n  float bounces = 0.;\n  bool stopBouncing = false;\n  float totalTimeOfBounce; \n  for (int n = 0; n < maxBounces; n++) {\n    bounces = float(n);\n    totalTimeOfBounce = t0 * pow(bouncyness, bounces);\n    if (t - T > totalTimeOfBounce) {\n      T += totalTimeOfBounce;\n      // T was incremented above\n      stopBouncing = t - T > totalTimeOfBounce;\n    } else {\n      break;\n    }\n  }\n\n  float y = a_position.y;\n  float dt = t - T;\n  float vn = - g * totalTimeOfBounce;\n\n  if (stopBouncing) {\n    y += yMax;\n  } else {\n    // Main formula\n    y += yMax + vn * dt + g * dt * dt;\n  }\n\n  gl_Position = vec4(\n    clipSpace(vec2(\n      a_position.x,\n      y\n    )),\n    0,\n    1\n  );\n}');
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, 'precision lowp float;\n\nvoid main(void) {\n  gl_FragColor = vec4(0, 0, 0, 1);\n}');
  var program = vertexShader && fragmentShader && createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    console.error('No program! Aborting...', vertexShader, fragmentShader);
    return;
  }
  // time
  var timeUniformLocation = gl.getUniformLocation(program, "u_time");

  // position: binding
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // position: setup
  var rects = createSkylineRects();
  var positions = asFloat32Array(rects);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // draw constants
  var size = 3; // x, y as normal, z is height of box
  var stride = 0;
  var offset = 0;
  var type = gl.FLOAT;
  var normalize = false;
  var primitiveType = gl.TRIANGLES;
  var count = positions.length / size;

  function draw() {
    resize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.uniform1f(timeUniformLocation, time);
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

    gl.drawArrays(primitiveType, offset, count);
  };

  // I am not sure if I would return an object it like this in an actual app,
  // I thought it looked cute though :)
  return {
    draw: draw,
    reset: reset,
    iterateTime: iterateTime
  };
}

/*
 * WebGL boiler-plate stuff
 * Inspired by the tutorials on webglfundamentals.org
 */
function createShader(gl, type, text) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, text);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.error('Could not create/compile ' + type + ' shader:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return;
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.error('Failed to create program', gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return;
}

function resize(canvas) {
  var realToCSSPixels = window.devicePixelRatio;
  var displayWidth = Math.floor(canvas.clientWidth * realToCSSPixels);
  var displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}
