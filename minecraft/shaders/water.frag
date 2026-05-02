#version 330 core

layout (location = 0) out vec4 fragColor;

const vec3 gamma = vec3(2.2);
const vec3 inv_gamma = 1 / gamma;

in vec2 uv;

uniform sampler2D u_texture_0;
uniform float water_line;
uniform float time;


void main() {
    vec2 flow_uv = uv + vec2(sin(uv.y * 0.2 + time * 1.6), cos(uv.x * 0.18 - time * 1.3)) * 0.03;
    vec3 tex_col = texture(u_texture_0, flow_uv).rgb;
    tex_col = pow(tex_col, gamma);

    // fog
    float fog_dist = gl_FragCoord.z / gl_FragCoord.w;
    float alpha = mix(0.58, 0.0, 1.0 - exp(-0.000002 * fog_dist * fog_dist));

    // gamma corretion
    tex_col = pow(tex_col, inv_gamma);
    fragColor = vec4(tex_col, alpha);
}
