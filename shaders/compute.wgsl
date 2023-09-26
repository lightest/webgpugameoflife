@group(0) @binding(0) var<uniform> colsRows: vec2f;
@group(0) @binding(1) var<storage> cellStateIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

fn getCellIdx (xIn: u32, yIn: u32) -> u32
{
	var x = xIn;
	var y = yIn;
	let u32Cols = u32(colsRows.x);
	let u32Rows = u32(colsRows.y);

	// TODO: how to have this without if statements?
	if (x < 0)
	{
		x = u32Cols + x;
	}
	if (y < 0)
	{
		y = u32Rows + y;
	}
	return (x % u32Cols) + (y % u32Rows) * u32Cols;
}

@compute
@workgroup_size(8, 8)
fn compute_main (@builtin(global_invocation_id) invId: vec3u) {
	let cellIdx = getCellIdx(invId.x, invId.y);

	let activeNeighboursAmount =
	cellStateIn[ getCellIdx(invId.x - 1, invId.y) ] +
	cellStateIn[ getCellIdx(invId.x + 1, invId.y) ] +
	cellStateIn[ getCellIdx(invId.x, invId.y - 1) ] +
	cellStateIn[ getCellIdx(invId.x, invId.y + 1) ] +
	cellStateIn[ getCellIdx(invId.x - 1, invId.y - 1) ] +
	cellStateIn[ getCellIdx(invId.x + 1, invId.y - 1) ] +
	cellStateIn[ getCellIdx(invId.x - 1, invId.y + 1) ] +
	cellStateIn[ getCellIdx(invId.x + 1, invId.y + 1) ];

	// Conway's game of life rules:
	if (cellStateIn[cellIdx] == 1 && (activeNeighboursAmount < 2 || activeNeighboursAmount > 3))
	{
		cellStateOut[cellIdx] = 0;
	}
	else if (cellStateIn[cellIdx] == 1 && (activeNeighboursAmount == 2 || activeNeighboursAmount == 3))
	{
		cellStateOut[cellIdx] = 1;
	}
	else if (cellStateIn[cellIdx] == 0 && activeNeighboursAmount == 3)
	{
		cellStateOut[cellIdx] = 1;
	}
	else {
		cellStateOut[cellIdx] = cellStateIn[cellIdx];
	}
}
