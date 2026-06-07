import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeContentVersion, generateAudioScript } from '@/lib/materialEnhancements';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const materialId = params.id;

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        title: true,
        content: true,
        contentVersion: true,
        audioScript: true,
        audioScriptVer: true,
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const currentVersion = material.contentVersion || computeContentVersion(material.content);

    // Cache hit
    if (material.audioScript && material.audioScriptVer === currentVersion) {
      return NextResponse.json({
        materialId: material.id,
        version: currentVersion,
        source: 'cache',
        audioScript: material.audioScript,
      });
    }

    // Generate once, then persist (global per material)
    const audioScript = await generateAudioScript(material.title, material.content);

    await prisma.material.update({
      where: { id: materialId },
      data: {
        contentVersion: currentVersion,
        audioScript,
        audioScriptVer: currentVersion,
      },
      select: { id: true },
    });

    return NextResponse.json({
      materialId: material.id,
      version: currentVersion,
      source: 'generated',
      audioScript,
    });
  } catch (error) {
    console.error('Error generating audio script:', error);
    return NextResponse.json(
      {
        error: 'Failed to get audio script',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
