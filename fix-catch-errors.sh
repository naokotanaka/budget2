#!/bin/bash

# catch (error) を catch (error: any) に置換するスクリプト

echo "Fixing catch (error) statements..."

# .ts, .svelte ファイルを対象に修正
find src -type f \( -name "*.ts" -o -name "*.svelte" \) -exec sed -i 's/} catch (error) {/} catch (error: any) {/g' {} \;

echo "Fixed catch statements in TypeScript and Svelte files"

# 結果を確認
echo "Checking for remaining catch (error) statements..."
grep -r "} catch (error) {" src --include="*.ts" --include="*.svelte" | wc -l