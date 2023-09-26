@fragment
fn fragment_main (fragData: VertexOut) -> @location(0) vec4f
{
    // var out: vec4f = vec4f(fragData.color.xy * fragData.cell, fragData.color.zw);
    let c = fragData.cell / colsRows;
    var out: vec4f = vec4f(c, 1f - c.x, 1f);
    return out;
}
