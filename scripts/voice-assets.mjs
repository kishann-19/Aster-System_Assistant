import {downloadAsset} from './download-asset.mjs';

for (const file of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']) {
  await downloadAsset(
    'native/voice-model/' + file,
    'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/' + file,
  );
}
console.log('Neural voice assets verified.');
