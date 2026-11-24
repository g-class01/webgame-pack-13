#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_diffuseMap;
#endif

varying vec2 uv0;

uniform sampler2D texture_mask;
uniform sampler2D dirt_texture;

void getAlbedo() {
    vec3 v_color = vec3(1.0) * gammaCorrectInput(saturate(vVertexColor.$VC));
    vec3 dirty = mix(vec3(0.05,0.025,0),v_color, texture2D(dirt_texture, $UV * 10.0).rgb * 0.25);
    dAlbedo = mix(dirty,v_color,texture2D(texture_mask, $UV).x);
}