package io.github.dobbylee.cherryk.support

import io.github.dobbylee.cherryk.application.ocr.OcrImage
import io.github.dobbylee.cherryk.application.ocr.OcrImageFormat
import io.github.dobbylee.cherryk.application.ocr.OcrProvider
import io.github.dobbylee.cherryk.application.ocr.OcrResult

class FakeOcrProvider(
    var result: OcrResult = OcrResult(extractedText = "저는 학교에 공부했어요."),
) : OcrProvider {
    var callCount: Int = 0
        private set
    var lastFormat: OcrImageFormat? = null
        private set

    override fun extract(image: OcrImage): OcrResult {
        callCount += 1
        lastFormat = image.format
        return result
    }
}
