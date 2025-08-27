// Test script for the improved VEO parser with real URL
import { parseVeoVideo } from './dist/utils/veoParser.js';

async function testVeoParser()
{
  console.log('🧪 Testing improved VEO parser with real URL...');

  // Test with the actual VEO URL
  const testUrl = 'https://app.veo.co/matches/20250518-match-spartans-9a1f4d76';

  try
  {
    console.log(`🚀 Testing with URL: ${testUrl}`);
    const result = await parseVeoVideo(testUrl);

    if ('error' in result)
    {
      console.log('❌ Parser returned error:', result.error);
      console.log('📝 Error details:', result.details || 'No additional details');

      // Check if it's a detached frame error
      if (result.details && result.details.includes('detached Frame'))
      {
        console.error('💥 DETACHED FRAME ERROR STILL OCCURRING!');
        process.exit(1);
      }
    }
    else
    {
      console.log('🎉 Successfully parsed video!');
      console.log('📹 Video URL:', result.videoUrl);
      console.log('🖼️ Poster URL:', result.posterUrl);
    }

    console.log('✅ Test completed - No detached frame errors occurred!');
  }
  catch (error)
  {
    console.error('💥 Unexpected error:', error.message);

    if (error.message.includes('detached Frame'))
    {
      console.error('❌ DETACHED FRAME ERROR STILL OCCURRING IN CATCH!');
      process.exit(1);
    }
    else
    {
      console.log('ℹ️  Error was not frame-related, which is acceptable');
    }
  }
}

// Run the test
testVeoParser().then(() =>
{
  console.log('🎯 VEO parser test with real URL completed!');
  process.exit(0);
}).catch(error =>
{
  console.error('💥 Test failed:', error);
  process.exit(1);
});
