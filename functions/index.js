const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp()
const path = require('path');
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");

const os = require('os');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

exports.fromWebmToMp4 = functions.region('europe-west1').storage.object().onFinalize(async (object) => {

  functions.logger.log("in function. step 1");

  const oStorage = admin.storage();
  const oBuck = oStorage.bucket(object.bucket); // The Storage bucket that contains the file.
  const filePath = object.name; // File path in the bucket.
  const contentType = object.contentType; // File content type.

  functions.logger.log("step 2");

    // Exit if this is triggered on a file that is not of type webm
  /*
    if (!contentType.endsWith('webm')) {
    return functions.logger.log('This is not an image.');
  }
*/
  // Get the file name.
  const sFlNm = path.basename(filePath);

  const tempFilePath = path.join(os.tmpdir(), sFlNm);
  const tempFilePathNew = tempFilePath.replace(".webm",".mp4");

  await oBuck.file(filePath).download({destination: tempFilePath});
  functions.logger.log('fl downloaded locally to', tempFilePath);
  
  const sNewLocInBucket = path.join(path.dirname(filePath), sFlNm.replace(".webm",".mp4"));



  functions.logger.log("step 3. old location="+filePath+". new location="+sNewLocInBucket);
  
  const remoteWriteStream = await oBuck
  .file(sFlNm.replace(".webm", ".mp4"))
  .createWriteStream({
    metadata: {
      contentType: "video/mp4",
    },
  });

  functions.logger.log("step 4. file name is - "+sFlNm);
 

// Open read stream to our uploaded file
const remoteReadStream = await oBuck.file(sFlNm).createReadStream();

functions.logger.log("step 5");

// Transcode
await ffmpeg(tempFilePath)
/*
  .outputOptions("-c:v libx265 -x265-params lossless=1")
  .outputOptions("-c:v copy")
  .outputOptions("-c:a aac")
  .outputOptions("-b:a 160k")
*/  
  .outputOptions("-c:v libx265")
  .outputOptions("-crf 51")
  .outputOptions("-preset ultrafast")
  .outputOptions("-f mp4")
  .on("start", async (cmdLine) => {
    functions.logger.log("in ffmpeg123 - new day new start");
    functions.logger.log("Started ffmpeg with command:", cmdLine);
  })
  .on("progress", function(progress) {
    functions.logger.log("progressing: " + progress.timemark + " seconds");
  })
  .on("end", async () => {
    functions.logger.log("Successfully re-encoded video.whooo");

    await oBuck.upload(tempFilePathNew, {
      destination: sNewLocInBucket,
      metadata: {
        contentType: "video/mp4",
      },
    });
  
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(tempFilePathNew);

  })
  .on("error", async (err, stdout, stderr) => {
    functions.logger.log("An error occured during encoding", err.message);
    functions.logger.log("stdout:", stdout);
    functions.logger.log("stderr:", stderr);
  })
  .save(tempFilePathNew);  

  functions.logger.log("new try new hopes old mistakes123");

});
