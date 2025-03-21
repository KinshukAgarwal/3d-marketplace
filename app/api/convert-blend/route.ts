import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const mkdirPromise = promisify(fs.mkdir);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    
    if (!file || !userId) {
      return NextResponse.json(
        { error: 'Missing file or user ID' },
        { status: 400 }
      );
    }

    // Create a unique ID for this conversion
    const conversionId = uuidv4();
    const tempDir = path.join(os.tmpdir(), conversionId);
    
    // Create temp directory
    await mkdirPromise(tempDir, { recursive: true });
    
    // Save the blend file to temp directory
    const blendFilePath = path.join(tempDir, file.name);
    const fileBuffer = await file.arrayBuffer();
    await writeFilePromise(blendFilePath, Buffer.from(fileBuffer));
    
    // Since we can't reliably convert the Blender file on the server,
    // we'll just upload the original file and mark it as not converted
    console.log('Uploading original Blender file');
    const fileName = `${userId}/${conversionId}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const { error: uploadError } = await supabase.storage
      .from('models')
      .upload(fileName, Buffer.from(fileBuffer));
      
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('models')
      .getPublicUrl(fileName);
    
    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return NextResponse.json({
      path: fileName,
      url: urlData.publicUrl,
      converted: false,
      message: 'Blender file uploaded successfully'
    });
  } catch (error) {
    console.error('Error in convert-blend API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}




























