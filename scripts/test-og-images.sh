#!/bin/bash
# File: scripts/test-og-images.sh

echo "🎨 Testing OG Image Generation..."
echo ""
echo "Note: Backend API URLs (from env):"
echo "  API_V2_URL:       ${API_V2_URL:-"(not set)"}"
echo ""

BASE_URL="${1:-http://localhost:3222}"

echo "1️⃣ Testing query parameter (search URL)..."
curl -s -o /tmp/og-test-1.png "$BASE_URL/api/og?q=bohemian+rhapsody"
if [ -s /tmp/og-test-1.png ]; then
  FILE_SIZE=$(stat -f%z /tmp/og-test-1.png 2>/dev/null || stat -c%s /tmp/og-test-1.png 2>/dev/null)
  echo "   ✅ Generated image: ${FILE_SIZE} bytes"
  echo "   📷 Preview: $BASE_URL/api/og?q=bohemian+rhapsody"
else
  echo "   ❌ Failed to generate image"
fi
echo ""

echo "2️⃣ Testing direct parameters..."
curl -s -o /tmp/og-test-2.png "$BASE_URL/api/og?title=Test%20Song&artist=Test%20Artist&album=Test%20Album&duration=180"
if [ -s /tmp/og-test-2.png ]; then
  FILE_SIZE=$(stat -f%z /tmp/og-test-2.png 2>/dev/null || stat -c%s /tmp/og-test-2.png 2>/dev/null)
  echo "   ✅ Generated image: ${FILE_SIZE} bytes"
  echo "   📷 Preview: $BASE_URL/api/og?title=Test%20Song&artist=Test%20Artist"
else
  echo "   ❌ Failed to generate image"
fi
echo ""

echo "3️⃣ Testing fallback (should redirect to static)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/og")
if [ "$HTTP_CODE" = "302" ]; then
  echo "   ✅ Correctly redirects to static image (HTTP $HTTP_CODE)"
else
  echo "   ⚠️  Unexpected status code: HTTP $HTTP_CODE"
fi
echo ""

echo "4️⃣ Testing page metadata..."
META_CHECK=$(curl -s "$BASE_URL/?q=test" | grep -c 'property="og:image"')
if [ "$META_CHECK" -gt 0 ]; then
  echo "   ✅ Page includes OG image meta tag"
  OG_URL=$(curl -s "$BASE_URL/?q=test" | grep 'property="og:image"' | sed 's/.*content="\([^"]*\)".*/\1/' | head -1)
  echo "   🔗 OG Image URL: $OG_URL"
else
  echo "   ❌ Missing OG image meta tag"
fi
echo ""

echo "5️⃣ Server logs (check for errors)..."
echo "   💡 Check your terminal running 'npm run dev' for [OG Route] logs"
echo ""

echo "🎉 Test complete!"
echo ""
echo "To view images:"
echo "   open /tmp/og-test-1.png"
echo "   open /tmp/og-test-2.png"
echo ""
echo "Or open in browser:"
echo "   $BASE_URL/api/og?q=test"
