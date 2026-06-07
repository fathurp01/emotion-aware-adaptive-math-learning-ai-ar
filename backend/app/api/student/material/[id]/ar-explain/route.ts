import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  computeContentVersion,
  generateArExplanation,
  generateArRecipe,
} from '@/lib/materialEnhancements';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const cachedRecipe = material.arRecipe as any | null;
    const cachedExplain = cachedRecipe?.explain;
    const cachedExplainVer = cachedRecipe?.explainVer;

    if (!shouldForce && cachedExplain && cachedExplainVer === currentVersion) {
      return NextResponse.json({
        materialId: material.id,
        version: currentVersion,
        source: 'cache',
        explanation: cachedExplain,
      });
    }

    // Ensure recipe exists and is current.
    let arRecipe: any = cachedRecipe;
    let recipeSource: 'cache' | 'generated' | 'forced' = 'cache';

    if (!arRecipe || material.arRecipeVer !== currentVersion) {
      arRecipe = await generateArRecipe(material.title, material.content);
      recipeSource = 'generated';
    }

    const explanation = await generateArExplanation({
      title: material.title,
      content: material.content,
      arRecipe,
    });

    // Cache explanation inside arRecipe JSON to avoid schema changes.
    const updatedArRecipe = {
      ...(arRecipe || {}),
      explain: explanation,
      explainVer: currentVersion,
    };

    await prisma.material.update({
      where: { id: materialId },
      data: {
        contentVersion: currentVersion,
        arRecipe: updatedArRecipe,
        arRecipeVer: material.arRecipeVer === currentVersion ? material.arRecipeVer : currentVersion,
      },
      select: { id: true },
    });

    return NextResponse.json({
      materialId: material.id,
      version: currentVersion,
      source: shouldForce ? 'forced' : recipeSource,
      explanation,
    });
  } catch (error) {
    console.error('Error generating AR explanation:', error);
    return NextResponse.json(
      {
        error: 'Failed to get AR explanation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
