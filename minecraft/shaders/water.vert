#version 330 core

layout (location = 0) in vec2 in_tex_coord;
layout (location = 1) in vec3 in_position;

uniform mat4 m_proj;
uniform mat4 m_view;
uniform mat4 m_view_proj;
uniform int water_area;
uniform float water_line;
uniform float time;

out vec2 uv;


void main() {
    vec3 pos = in_position;
    pos.xz *= water_area;
    pos.xz -= 0.33 * water_area;

    float wave = sin((pos.x + time * 5.0) * 0.01) * 0.08 +
                 cos((pos.z - time * 4.0) * 0.012) * 0.06;
    pos.y += water_line + wave;
    uv = in_tex_coord * water_area + vec2(time * 0.05, -time * 0.03);
    gl_Position = m_proj * m_view * vec4(pos, 1.0);
}
