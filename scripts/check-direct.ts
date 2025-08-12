#!/usr/bin/env tsx
/**
 * データベースを直接確認
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDirect() {
  try {
    const tx = await prisma.transaction.findFirst({
      where: { freeDealId: BigInt(2922094921) }
    });
    
    console.log('取引ID 2922094921 のデータ:');
    console.log('  account:', tx?.account);
    console.log('  updatedAt:', tx?.updatedAt);
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDirect();