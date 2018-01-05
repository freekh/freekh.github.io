attribute vec3 a_position;
uniform float u_time;

const float g = 9.81; // Could be whatevs really
const float bouncyness = 0.5;
const int maxBounces = 20;

// This could be improved with scaling ratios but I am happy enough already
vec2 clipSpace(vec2 position) {
  return ((position / (100.0 / 2.0)) - 1.0) * vec2(1.0, -1.0);
}

void main() {
  float yMax = 100. - a_position.z;
  float t = u_time;
  float t0 = 2.0 * sqrt(yMax / g);
  float T = 0.;

  float bounces = 0.;
  bool stopBouncing = false;
  float totalTimeOfBounce; 
  for (int n = 0; n < maxBounces; n++) {
    bounces = float(n);
    totalTimeOfBounce = t0 * pow(bouncyness, bounces);
    if (t - T > totalTimeOfBounce) {
      T += totalTimeOfBounce;
      // T was incremented above
      stopBouncing = t - T > totalTimeOfBounce;
    } else {
      break;
    }
  }

  float y = a_position.y;
  float dt = t - T;
  float vn = - g * totalTimeOfBounce;

  if (stopBouncing) {
    y += yMax;
  } else {
    // Main formula
    y += yMax + vn * dt + g * dt * dt;
  }

  gl_Position = vec4(
    clipSpace(vec2(
      a_position.x,
      y
    )),
    0,
    1
  );
}