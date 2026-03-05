import asyncio

async def read_limited_bytes(reader, max_bytes, chunk_size=8192):
    """Read up to max_bytes from the reader, returning earlier if EOF or no more data available."""
    chunks = []
    bytes_read = 0
    
    # Read in smaller chunks to avoid hanging
    chunk_size = min(chunk_size, max_bytes - bytes_read)
    
    while bytes_read < max_bytes:
        try:
            # Use read() with timeout to check for available data
            chunk = await asyncio.wait_for(reader.read(chunk_size), timeout=1.0)
            if not chunk:  # EOF reached
                break
            chunks.append(chunk)
            bytes_read += len(chunk)
            
            # Adjust chunk size for remaining bytes
            remaining = max_bytes - bytes_read
            if remaining <= 0:
                break
            chunk_size = min(chunk_size, remaining)
            
        except asyncio.TimeoutError:
            # No more data available right now, but process might still be writing
            # Check if we have any data and if process is still running
            if bytes_read > 0:
                break
            else:
                # If we haven't read anything yet, continue trying
                continue
    
    return b"".join(chunks)
