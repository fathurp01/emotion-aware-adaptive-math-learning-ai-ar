import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeContentVersion, generateArRecipe } from '@/lib/materialEnhancements';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const materialId = params.id;
    const force = request.nextUrl.searchParams.get('force');
    const shouldForce = force === '1' || force?.toLowerCase() === 'true';

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: {
        id: true,
        title: true,
        content: true,
        contentVersion: true,
        arRecipe: true,
        arRecipeVer: true,
      },
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const currentVersion = material.contentVersion || computeContentVersion(material.content);

    if (!shouldForce && material.arRecipe && material.arRecipeVer === currentVersion) {
      return NextResponse.json({
        materialId: material.id,
        version: currentVersion,
        source: 'cache',
        arRecipe: material.arRecipe,
      });
    }

    const arRecipe = await generateArRecipe(material.title, material.content);

    await prisma.material.update({
      where: { id: materialId },
      data: {
        contentVersion: currentVersion,
        arRecipe,
        arRecipeVer: currentVersion,
      },
      select: { id: true },
    });

    return NextResponse.json({
      materialId: material.id,
      version: currentVersion,
      source: shouldForce ? 'forced' : 'generated',
      arRecipe,
    });
  } catch (error) {
    console.error('Error generating AR recipe:', error);
    return NextResponse.json(
      {
        error: 'Failed to get AR recipe',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
