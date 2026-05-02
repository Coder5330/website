#version 330 core
in vec2 uv;
out vec4 fragColor;

uniform sampler2D u_texture;

void main() {
    vec4 col = texture(u_texture, uv);
    if (col.a < 0.1) discard;
    fragColor = col;
}