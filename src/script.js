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
  const header = document.getElementsByTagName('header')[0];
  const stats = document.getElementById('stats');

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
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl');

  if (!gl) {
    console.error('This browser does not have a context I can draw cool stuff in. No worries tho');
    return;    
  }

  const scene = initScene(gl);
  scene.draw(); // draw first time

  let stopped = true;
  let waitUntil = 0;
  function iterate() {
    scene.iterateTime();
    scene.draw();
    if (!stopped) {
      requestAnimationFrame(iterate);
    }
  }

  function bounceOnScroll() {
    // should be supported by most browsers
    const scrolledToBottom = document.body.scrollHeight === window.scrollY + window.innerHeight;
    const scrolledAboveCanvas = document.body.scrollHeight - (window.scrollY + window.innerHeight) > canvas.scrollHeight;
    if (scrolledToBottom) { // bounce every time client scrolls to the bottom
      if (waitUntil < new Date().getTime()) {
        // we just reset, though it would be cool to reset the ones that where touching the ground
        // alas, I didn't feel like spending any more time on this
        scene.reset();
        if (stopped) {
          waitUntil = new Date().getTime() + 1000; // wait 1s before starting again because Safari makes it possible to scroll beyond.
          stopped = false;
          iterate();
        }
      }
    } else if (scrolledAboveCanvas) { // stop drawing if we can't see it
      waitUntil = 0;
      stopped = true;
      scene.reset();
      scene.draw();
    }
  }

  window.addEventListener('scroll', bounceOnScroll);
};

function rect(originX, originY, width, height) {
  // z is always height - required to know when to bounce
  return [
    originX, originY, height,
    originX + width, originY, height,
    originX + width, originY + height, height,

    originX + width, originY + height, height,
    originX, originY + height, height,
    originX, originY, height,
  ];
}

function createSkylineRects() {
  const amount = 100; // one per unit;
  // Array.map might not always be supported, but
  // most browsers that does not support it, will 
  // probably have issues with the rest of the shader in any case.
  // Since this is a purely visual effect, it's OK if it fails.
  // In this instance, I'd rather it fail than having a large
  // (and slow) polyfill  :)
  return new Array(amount)
    .fill()
    .map((_, i) => { // I would say my style is more functional like this normally
    const height = Math.round(Math.random() * 30 + 30); // must be within 0-100, other numbers are just random
    return rect(i, 0, 1, height);
  });
}

function asFloat32Array(rects) {
  const trianglesPerRect = 3 * 6;

  // Not sure if Float32Array.from is supported everywhere
  const positions = new Float32Array(rects.length * trianglesPerRect);

  for (let i = 0; i < rects.length; i++) {
    for (let j = 0; j < trianglesPerRect; j++) {
      positions[i * trianglesPerRect + j] = rects[i][j];
    }
  }
  return positions;
}

function initScene(gl) {
  let time = 0;

  function reset() {
    time = 0;
  }
  
  function iterateTime() {
    time += 0.1; // random, ends up looking nice with current constants
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, include('bounce.vert'));
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, include('black.frag'));
  const program = vertexShader && fragmentShader &&
        createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    console.error('No program! Aborting...', vertexShader, fragmentShader);
    return;
  }
  // time
  const timeUniformLocation = gl.getUniformLocation(program, "u_time");
    
  // position: binding
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // position: setup
  const rects = createSkylineRects();
  const positions = asFloat32Array(rects);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  
  // draw constants
  const size = 3; // x, y as normal, z is height of box
  const stride = 0;
  const offset = 0;
  const type = gl.FLOAT;
  const normalize = false;
  const primitiveType = gl.TRIANGLES;
  const count = positions.length / size;

  function draw() {
    resize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    gl.uniform1f(timeUniformLocation, time);
    gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);

    gl.drawArrays(primitiveType, offset, count);
  };

  // I am not sure if I would return an object it like this in an actual app,
  // I thought it looked cute though :)
  return {
    draw,
    reset,
    iterateTime,
  };
}

/*
 * WebGL boiler-plate stuff
 * Inspired by the tutorials on webglfundamentals.org
 */
function createShader(gl, type, text) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, text);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }
 
  console.error('Could not create/compile '+type+' shader:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }
 
  console.error('Failed to create program', gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return;
}

function resize(canvas) {
  const realToCSSPixels = window.devicePixelRatio;
  const displayWidth  = Math.floor(canvas.clientWidth  * realToCSSPixels);
  const displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);

  if (canvas.width  !== displayWidth ||
      canvas.height !== displayHeight) {
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }
}
