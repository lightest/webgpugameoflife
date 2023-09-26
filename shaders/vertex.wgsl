@group(0) @binding(0) var<uniform> colsRows: vec2f;
@group(0) @binding(1) var<storage> cellStates: array<u32>;

struct VertexIn {
    @location(0) position: vec4f,
    @location(1) color: vec4f,
    @builtin(instance_index) instance: u32
}

struct VertexOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) cell: vec2f
}

@vertex
fn vertex_main(input: VertexIn) -> VertexOut
{
    let i = f32(input.instance);
    let cell = vec2f(i % colsRows.x, floor(i / colsRows.y));
    let state = f32(cellStates[input.instance]);
    let positioningShift = cell / colsRows * 2;
    var output: VertexOut;
    output.position = vec4((input.position.xy * state + 1f) / colsRows - 1f + positioningShift, input.position.zw);
    output.color = input.color;
    output.cell = cell;

    return output;
}
