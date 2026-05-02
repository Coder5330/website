#version 330 core
layout (location = 0) out vec4 fragColor;
const vec3 gamma = vec3(2.2);
const vec3 inv_gamma = 1 / gamma;
uniform sampler2DArray u_texture_array_0;
uniform sampler2D u_texture_1;
uniform sampler2DArray u_texture_array_1;
uniform sampler2DArray u_crack_array;
uniform sampler2D u_crafting_table;
uniform vec3 bg_color;
uniform float water_line;
uniform float time;
uniform int crack_stage;
uniform vec3 crack_voxel_pos;

in vec2 uv;
in float shading;
in vec3 frag_world_pos;
flat in int face_id;
flat in int voxel_id;
flat in vec3 frag_normal;

uniform float light_level;

const int COAL_ORE = 12;
const int IRON_ORE = 13;
const int COPPER_ORE = 14;
const int GOLD_ORE = 15;
const int REDSTONE_ORE = 16;
const int DIAMOND_ORE = 17;
const int DEEPSLATE_DIAMOND_ORE = 18;
const int CRAFTING_TABLE = 19;
const int STONE = 4;
const int WATER_BLOCK = 8;
const int BEDROCK = 9;
const int DEEPSLATE = 10;
const int LAVA = 11;

vec3 get_block_texture(vec2 face_uv) {
    if (voxel_id == WATER_BLOCK) {
        vec2 water_uv = fract(face_uv * 2.0 + vec2(time * 0.10, -time * 0.07));
        water_uv += vec2(
            sin((face_uv.y + time) * 8.0),
            cos((face_uv.x - time) * 8.0)
        ) * 0.015;
        return texture(u_texture_1, fract(water_uv)).rgb;
    }
    if (voxel_id == BEDROCK || voxel_id == DEEPSLATE || voxel_id == LAVA) {
        return texture(u_texture_array_0, vec3(face_uv, STONE)).rgb;
    }
    if (voxel_id == CRAFTING_TABLE) {
        return texture(u_crafting_table, face_uv).rgb;
    }
    if (voxel_id == COAL_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 0)).rgb;
    }
    if (voxel_id == IRON_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 1)).rgb;
    }
    if (voxel_id == GOLD_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 2)).rgb;
    }
    if (voxel_id == DIAMOND_ORE || voxel_id == DEEPSLATE_DIAMOND_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 3)).rgb;
    }
    if (voxel_id == REDSTONE_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 4)).rgb;
    }
    if (voxel_id == COPPER_ORE) {
        return texture(u_texture_array_1, vec3(face_uv, 5)).rgb;
    }
    return texture(u_texture_array_0, vec3(face_uv, voxel_id)).rgb;
}

void main() {
    vec2 face_uv = uv;
    face_uv.x = uv.x / 3.0 - min(face_id, 2) / 3.0;
    vec3 tex_col = get_block_texture(face_uv);
    tex_col = pow(tex_col, gamma);
    tex_col *= shading;
    tex_col *= light_level;
    float alpha = voxel_id == WATER_BLOCK ? 0.65 : 1.0;

    // crack overlay
    if (crack_stage >= 0) {
        vec3 n = abs(frag_normal);
        // project world pos onto face plane to get crack UV
        vec2 crack_uv;
        if (n.y > 0.5) {
            crack_uv = fract(frag_world_pos.xz);
        } else if (n.x > 0.5) {
            crack_uv = fract(frag_world_pos.zy);
        } else {
            crack_uv = fract(frag_world_pos.xy);
        }
        // check fragment belongs to the target block
        const float EPS = 0.001;
        vec3 block_min = crack_voxel_pos - vec3(EPS);
        vec3 block_max = crack_voxel_pos + vec3(1.0 + EPS);
        if (all(greaterThan(frag_world_pos, block_min)) &&
            all(lessThan(frag_world_pos, block_max))) {
            vec4 crack_col = texture(u_crack_array, vec3(crack_uv, crack_stage));
            // pure black crack lines, no grey
            tex_col = mix(tex_col, vec3(0.0), crack_col.a);
        }
    }

    if (voxel_id != WATER_BLOCK && frag_world_pos.y < water_line) tex_col *= vec3(0.0, 0.3, 1.0);
    float fog_dist = gl_FragCoord.z / gl_FragCoord.w;
    tex_col = mix(tex_col, bg_color, (1.0 - exp2(-0.00001 * fog_dist * fog_dist)));
    tex_col = pow(tex_col, inv_gamma);
    fragColor = vec4(tex_col, alpha);
}
