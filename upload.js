const ci = require('miniprogram-ci');
const path = require('path');

const project = new ci.Project({
  appid: 'wx0b17eab2709852be',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, 'miniprogram'),
  privateKeyPath: path.resolve(__dirname, 'private.key'),
  ignores: ['node_modules/**/*']
});

async function upload() {
  const version = process.argv[2] || '1.0.0';
  const desc = process.argv[3] || '语音考核功能上线';

  try {
    const uploadResult = await ci.upload({
      project,
      version,
      desc,
      setting: {
        es6: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true
      },
      onProgressUpdate: console.log
    });
    console.log('上传成功:', uploadResult);
  } catch (error) {
    console.error('上传失败:', error);
    process.exit(1);
  }
}

upload();
