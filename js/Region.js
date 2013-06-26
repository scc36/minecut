Region = function(rx, rz) {
	this.location = {
		x: rx,
		z: rz
	};
	this.loaded = false;
	this.chunkOffsets = null;
	this.rawChunkData = null;
	this.chunks = {};
	this.callbacks = [];
};

Region.prototype.existsChunk = function(x, z) {
		if (x < 0 || x >= 32) {
			return false;
		}
		if (z < 0 || z >= 32) {
			return false;
		}
		var reader = new DataReader(this.rawChunkData);
		var num = this.chunkOffsets[x + z * 32];
		var offset = ((num>>24)&0xff) | // move byte 3 to byte 0
						((num<<8)&0xff0000) | // move byte 1 to byte 2
						((num>>8)&0xff00) | // move byte 2 to byte 1
						((num<<24)&0xff000000) // byte 0 to byte 3
		var sectorNumber = (offset >> 8) & 0xFFFFFF;
		var numSectors = offset & 0xFF;
		
		if (sectorNumber === 0 && numSectors === 0) {
			this.chunks[[x,z]] = null
			return false;
		}
		
		return true;
};
Region.prototype.getChunk = function(x, z) {
	if (this.loaded) {
		if (x < 0 || x >= 32) {
			return null;
		}
		if (z < 0 || z >= 32) {
			return null;
		}
		
		if (this.chunks[[x,z]] !== undefined) {
			return this.chunks[[x,z]];
		}
		
		var reader = new DataReader(this.rawChunkData);
		var num = this.chunkOffsets[x + z * 32];
		var offset = ((num>>24)&0xff) | // move byte 3 to byte 0
						((num<<8)&0xff0000) | // move byte 1 to byte 2
						((num>>8)&0xff00) | // move byte 2 to byte 1
						((num<<24)&0xff000000) // byte 0 to byte 3
		var sectorNumber = (offset >> 8) & 0xFFFFFF;
		var numSectors = offset & 0xFF;
		
		if (sectorNumber === 0 && numSectors === 0) {
			this.chunks[[x,z]] = null
			return null;
		}

		reader.seek((sectorNumber-2) * 4096);

		var length = reader.readInteger32();
		var compressionType = reader.readByte();
		if (compressionType === 1) {
			// GZIP
			alert("gzip is not supported");
			this.chunks[[x,z]] = null;
			return null;
		} else if (compressionType === 2) {
			// ZLIB

			// since we're using deflate and not ZLIB, ignore first 2 bytes, and
			// last 4 bytes
			reader.readByte();
			reader.readByte();
			compressedChunkData = reader.readBytes(length - 5);

			/*
			 * FIND A BETTER INFLATE ALGORITHM THAT WORKS WITH NATIVE Uint8Arrays
			 */
			var inflated = new Array();
			err = puff(inflated, compressedChunkData);

			if (err != 0) {
				console.log("err puffing " + err);
				this.chunks[[x,z]] = null
				return null;
			}

			inflated = new Uint8Array(inflated);
		}
		
		this.chunks[[x,z]] = new Chunk(inflated, x, z);
		return this.chunks[[x,z]];
	}
	
	return null;
};
