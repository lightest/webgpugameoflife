const GRID_SIZE = 32;
const WORK_GROUP_SIZE = 8;
const MAX_FRAME_DURATION = 100; // Amount of ms to hold one frame for.

class MainModule
{
	constructor()
	{
		this._prevTime = performance.now();
		this._frameDuration = 0;
		this._simulationStep = 0;
		this._updateLoopBinded = this._updateLoop.bind(this);
	}

	async _getShaderSources()
	{
		let vertexSrc = await fetch("./shaders/vertex.wgsl");
		vertexSrc = await vertexSrc.text();
		let fragmentSrc = await fetch("./shaders/fragment.wgsl");
		fragmentSrc = await fragmentSrc.text();
		const shaders = `${vertexSrc}\n${fragmentSrc}`;

		return shaders;
	}

	async _getComputeShaderSources ()
	{
		let computeSrc = await fetch("./shaders/compute.wgsl");
		computeSrc = await computeSrc.text();

		return computeSrc;
	}

	_handleResize()
	{
		const pixelRatio = window.devicePixelRatio || 1.0;
		const width = window.innerWidth * pixelRatio | 0;
		const height = window.innerHeight * pixelRatio | 0;
		if (this._canvas.width !== width || this._canvas.height !== height)
		{
			this._canvas.width = width;
			this._canvas.height = height;
		}
	}

	_getPlaneVertices(m, n)
	{
		// const buffer = new Float32Array(m * n * 4);
		const buffer = new Float32Array([
			0.5, 0.5, 0, 1,
			1, 0, 0, 1,
			-0.5, -0.5, 0, 1,
			0, 1, 0, 1,
			0.5, -0.5, 0, 1,
			0, 0, 1, 1,
			-0.5, 0.5, 0, 1,
			0, 1, 1, 1
		]);

		const indices = new Uint32Array([
			0, 1, 2, 1, 3, 0
		]);

		return {
			vertex: buffer,
			index: indices
		};
	}

	_setupVertexBuffer(data)
	{
		this._vertexBuffer = this._device.createBuffer({
			size: data.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		});
		const bufferWriteStartIdx = 0
		const dataStartIdx = 0;
		this._device.queue.writeBuffer(
			this._vertexBuffer,
			bufferWriteStartIdx,
			data,
			dataStartIdx,
			data.length
		);
	}

	_setupIndexBuffer(data)
	{
		this._indexBuffer = this._device.createBuffer({
			size: data.byteLength,
			usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
		});
		const bufferWriteStartIdx = 0;
		this._device.queue.writeBuffer(
			this._indexBuffer,
			bufferWriteStartIdx,
			data
		);
	}

	_setupUniformsBuffer ()
	{
		const uniformsData = new Float32Array([GRID_SIZE, GRID_SIZE]);
		const uniformsBuffer = this._device.createBuffer({
			label: "grid uniforms",
			size: uniformsData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});
		this._device.queue.writeBuffer(
			uniformsBuffer,
			0,
			uniformsData
		);

		return uniformsBuffer;
	}

	_getCellIdx (x, y)
	{
		if (x < 0)
		{
			x = GRID_SIZE + x;
		}
		if (y < 0)
		{
			y = GRID_SIZE + y;
		}
		return (x % GRID_SIZE) + (y % GRID_SIZE) * GRID_SIZE;
	}

	_setupStorageBuffers ()
	{
		let i = 0;
		const cellStateData = new Uint32Array(GRID_SIZE * GRID_SIZE);
		const cellStorageBuffers = [
			this._device.createBuffer({
				label: "cell_state_0",
				size: cellStateData.byteLength,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			}),

			this._device.createBuffer({
				label: "cell_state_1",
				size: cellStateData.byteLength,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			})
		];

		for (i = 0; i < cellStateData.length; i += 3)
		{
			cellStateData[i] = Math.round(Math.random() + .1);
		}

		// Center of the grid;
		const x = Math.floor(GRID_SIZE * .5);
		const y = Math.floor(GRID_SIZE * .5);
		// Glider.
		// cellStateData[this._getCellIdx(x + 1, y)] = 1;
		// cellStateData[this._getCellIdx(x + 1, y - 1)] = 1;
		// cellStateData[this._getCellIdx(x, y - 1)] = 1;
		// cellStateData[this._getCellIdx(x - 1, y - 1)] = 1;
		// cellStateData[this._getCellIdx(x, y + 1)] = 1;


		this._device.queue.writeBuffer(
			cellStorageBuffers[0],
			0,
			cellStateData
		);

		// for (i = 0; i < cellStateData.length; i++)
		// {
		// 	cellStateData[i] = i % 2;
		// }

		this._device.queue.writeBuffer(
			cellStorageBuffers[1],
			0,
			cellStateData
		);

		return cellStorageBuffers;
	}

	async _setupPipelines(bindGroupLayout)
	{
		// TODO: Should this be a separate func?
		const shaderCode = await this._getShaderSources();
		const computeShaderCode = await this._getComputeShaderSources();
		const shaderModule = this._device.createShaderModule({
			code: shaderCode
		});

		const computeShaderModule = this._device.createShaderModule({
			code: computeShaderCode
		});

		const pipelineLayout = this._device.createPipelineLayout({
			bindGroupLayouts: [ bindGroupLayout ]
		});

		const buffersLayour = [
			{
				attributes: [
					{
						shaderLocation: 0,
						offset: 0,
						format: "float32x4"
					},
					{
						shaderLocation: 1,
						offset: 16, // bytes
						format: "float32x4"
					}
				],
				arrayStride: 32, // bytes
				stepMode: "vertex"
			}
		];

		const renderPipelineDescriptor = {
			vertex: {
				module: shaderModule,
				entryPoint: "vertex_main",
				buffers: buffersLayour,
			},

			fragment: {
				module: shaderModule,
				entryPoint: "fragment_main",
				targets: [
					{
						format: navigator.gpu.getPreferredCanvasFormat()
					}
				]
			},

			primitive: {
				topology: "triangle-list"
			},

			layout: pipelineLayout
		};

		const computePipelineDescriptor = {
			layout: pipelineLayout,
			compute: {
				module: computeShaderModule,
				entryPoint: "compute_main"
			}
		};

		this._renderPipeline = this._device.createRenderPipeline(renderPipelineDescriptor);
		this._computePipeline = this._device.createComputePipeline(computePipelineDescriptor);
	}

	_setupBindGroups (uniformsBuffer, storageBuffers)
	{
		const bindGroupLayout = this._device.createBindGroupLayout({
			label: "bind_group_layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
					buffer: { type: "uniform" }
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
					buffer: { type: "read-only-storage" }
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: { type: "storage" }
				}
			]
		});

		this._bindGroups = [
			this._device.createBindGroup({
				label: "bind_group_0",
				layout: bindGroupLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: uniformsBuffer }
					},
					{
						binding: 1,
						resource: { buffer: storageBuffers[0] }
					},
					{
						binding: 2,
						resource: { buffer: storageBuffers[1] }
					}
				]
			}),

			// Swapping storage buffers to swap cell states storages.
			this._device.createBindGroup({
				label: "bind_group_1",
				layout: bindGroupLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: uniformsBuffer }
					},
					{
						binding: 1,
						resource: { buffer: storageBuffers[1] }
					},
					{
						binding: 2,
						resource: { buffer: storageBuffers[0] }
					}
				]
			})
		];

		return bindGroupLayout;
	}

	_computeAndRenderPass()
	{
		const clearColor = { r: 0., g: 0., b: 0., a: 1.0 };

		const renderPassDescriptor = {
			colorAttachments: [
				{
					clearValue: clearColor,
					loadOp: "clear",
					storeOp: "store",
					view: this._ctx.getCurrentTexture().createView()
				}
			]
		};


		const commandEncoder = this._device.createCommandEncoder();
		const renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		renderPassEncoder.setPipeline(this._renderPipeline);
		renderPassEncoder.setVertexBuffer(0, this._vertexBuffer);
		renderPassEncoder.setIndexBuffer(this._indexBuffer, "uint32");
		renderPassEncoder.setBindGroup(0, this._bindGroups[this._simulationStep % 2]);
		// this._indexBuffer.size/4 due to uint32 - 4 bytes per index.
		renderPassEncoder.drawIndexed(this._indexBuffer.size / 4, GRID_SIZE * GRID_SIZE);
		renderPassEncoder.end();

		this._simulationStep++;

		const computePassEncoder = commandEncoder.beginComputePass();
		computePassEncoder.setPipeline(this._computePipeline);
		computePassEncoder.setBindGroup(0, this._bindGroups[this._simulationStep % 2]);
		const workGroupCount = Math.ceil(GRID_SIZE / WORK_GROUP_SIZE);
		computePassEncoder.dispatchWorkgroups(workGroupCount, workGroupCount);
		computePassEncoder.end();

		const commandBuffer = commandEncoder.finish();
		this._device.queue.submit([commandBuffer]);
	}

	_addEventListeners()
	{
		window.addEventListener("resize", () => { this._handleResize(); });
	}

	async init()
	{
		this._adapter = await navigator.gpu.requestAdapter({
			powerPreference: "high-performance"
		});
		this._device = await this._adapter.requestDevice();
		console.log(this._adapter, this._device);

		this._canvas = document.querySelector(".main-canvas");
		this._handleResize();
		this._ctx = this._canvas.getContext("webgpu");
		this._ctx.configure({
			device: this._device,
			format: navigator.gpu.getPreferredCanvasFormat(),
			alphaMode: "premultiplied"
		});
		const buffers = this._getPlaneVertices(32, 32);
		this._setupVertexBuffer(buffers.vertex);
		this._setupIndexBuffer(buffers.index);
		const uniformsBuffer = this._setupUniformsBuffer();
		const storageBuffers = this._setupStorageBuffers();
		const bindGroupLayout = this._setupBindGroups(uniformsBuffer, storageBuffers);
		await this._setupPipelines(bindGroupLayout);
		console.log(this._ctx);
		this._addEventListeners();

		this._updateLoop();
	}

	_updateLoop ()
	{
		requestAnimationFrame(this._updateLoopBinded);
		const dt = performance.now() - this._prevTime;
		this._frameDuration += dt;

		if (this._frameDuration >= MAX_FRAME_DURATION)
		{

			this._computeAndRenderPass ();
			this._frameDuration = 0;
		}

		this._prevTime = performance.now();
	}
}

window.onload = function ()
{
	var mm = new MainModule();
	mm.init();
	window.mm = mm;
}
