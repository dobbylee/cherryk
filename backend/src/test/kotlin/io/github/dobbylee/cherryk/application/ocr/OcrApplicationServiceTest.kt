package io.github.dobbylee.cherryk.application.ocr

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageQuota
import io.github.dobbylee.cherryk.application.usage.UsageReservation
import io.github.dobbylee.cherryk.infrastructure.image.Java2dOcrImageNormalizer
import org.junit.jupiter.api.Test
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class OcrApplicationServiceTest {
    @Test
    fun `normalizes the actual image type before reserving usage and calling the provider`() {
        val events = mutableListOf<String>()
        var receivedFormat: OcrImageFormat? = null
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota = RecordingUsageQuota(events),
                provider =
                    OcrProvider { image ->
                        events += "provider"
                        receivedFormat = image.format
                        OcrResult("저는 학교에 공부했어요.")
                    },
            )

        val result =
            service.extract(
                userId = 1,
                upload =
                    OcrUpload(
                        bytes = createJpeg(),
                        declaredContentType = "image/png",
                    ),
            )

        assertEquals(OcrResult("저는 학교에 공부했어요."), result)
        assertEquals(OcrImageFormat.JPEG, receivedFormat)
        assertEquals(listOf("reserve", "provider", "commit"), events)
    }

    @Test
    fun `rejects missing oversized non-image and spoofed uploads before usage`() {
        var usageCalls = 0
        var providerCalls = 0
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota =
                    object : UsageQuota {
                        override fun reserve(
                            userId: Long,
                            feature: UsageFeature,
                            units: Long,
                        ): UsageReservation {
                            usageCalls += 1
                            return UsageReservation(1, feature, units)
                        }

                        override fun commit(reservation: UsageReservation) = Unit

                        override fun release(reservation: UsageReservation) = Unit
                    },
                provider =
                    OcrProvider {
                        providerCalls += 1
                        OcrResult("unused")
                    },
            )
        val invalidUploads =
            listOf(
                OcrUpload(byteArrayOf(), "image/png"),
                OcrUpload(ByteArray(MAX_OCR_IMAGE_BYTES + 1), "image/png"),
                OcrUpload("not an image".toByteArray(), "text/plain"),
                OcrUpload("not an image".toByteArray(), "image/png"),
                OcrUpload(
                    byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()),
                    "image/jpeg",
                ),
            )

        invalidUploads.forEachIndexed { index, upload ->
            val exception =
                assertFailsWith<OcrApplicationException> {
                    service.extract(userId = 1, upload = upload)
                }
            assertEquals("invalid_image", exception.code)
            if (index == 3) {
                assertEquals(
                    "Upload a valid JPEG, PNG, or WebP image.",
                    exception.message,
                )
            }
            if (index == 4) {
                assertEquals("Image could not be processed.", exception.message)
            }
        }
        assertEquals(0, usageCalls)
        assertEquals(0, providerCalls)
    }

    @Test
    fun `does not make a paid call when usage reservation is rejected`() {
        var providerCalls = 0
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota =
                    object : UsageQuota {
                        override fun reserve(
                            userId: Long,
                            feature: UsageFeature,
                            units: Long,
                        ): UsageReservation = throw UsageRejectedException()

                        override fun commit(reservation: UsageReservation) = Unit

                        override fun release(reservation: UsageReservation) = Unit
                    },
                provider =
                    OcrProvider {
                        providerCalls += 1
                        OcrResult("unused")
                    },
            )

        assertFailsWith<UsageRejectedException> {
            service.extract(1, OcrUpload(createJpeg(), "image/jpeg"))
        }
        assertEquals(0, providerCalls)
    }

    @Test
    fun `maps an empty provider result to the existing manual entry response`() {
        val events = mutableListOf<String>()
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota = RecordingUsageQuota(events),
                provider =
                    OcrProvider {
                        throw OcrProviderException(
                            code = "empty_result",
                            message = "No readable text.",
                        )
                    },
            )

        val result = service.extract(1, OcrUpload(createJpeg(), "image/jpeg"))

        assertEquals("", result.extractedText)
        assertEquals(
            "No readable Korean text was found. Please try another image or enter the text manually.",
            result.note,
        )
        assertEquals(listOf("reserve", "commit"), events)
    }

    @Test
    fun `preserves provider failures for stable public error mapping`() {
        val timeout = OcrProviderException(code = "timeout", message = "OCR timed out.")
        val events = mutableListOf<String>()
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota = RecordingUsageQuota(events),
                provider = OcrProvider { throw timeout },
            )

        val actual =
            assertFailsWith<OcrProviderException> {
                service.extract(1, OcrUpload(createJpeg(), "image/jpeg"))
            }

        assertEquals(timeout, actual)
        assertEquals("timeout", actual.code)
        assertEquals(listOf("reserve", "release"), events)
    }

    @Test
    fun `replaces Korean provider notes with the existing English review note`() {
        val service =
            OcrApplicationService(
                imageNormalizer = Java2dOcrImageNormalizer(),
                usageQuota = RecordingUsageQuota(),
                provider =
                    OcrProvider {
                        OcrResult(
                            extractedText = "저는 학교에 공부했어요.",
                            note = "일부 글자를 정확히 알아볼 수 없습니다.",
                        )
                    },
            )

        val result = service.extract(1, OcrUpload(createJpeg(), "image/jpeg"))

        assertEquals(
            "Some characters could not be read with confidence. Please review and edit the extracted text.",
            result.note,
        )
    }
}

private class UsageRejectedException : RuntimeException()

private class RecordingUsageQuota(
    private val events: MutableList<String> = mutableListOf(),
) : UsageQuota {
    private var nextId = 1L

    override fun reserve(
        userId: Long,
        feature: UsageFeature,
        units: Long,
    ): UsageReservation {
        events += "reserve"
        assertEquals(UsageFeature.OCR, feature)
        assertEquals(1, units)
        return UsageReservation(nextId++, feature, units)
    }

    override fun commit(reservation: UsageReservation) {
        events += "commit"
    }

    override fun release(reservation: UsageReservation) {
        events += "release"
    }
}

private fun createJpeg(): ByteArray {
    val image = BufferedImage(32, 32, BufferedImage.TYPE_INT_RGB)
    return ByteArrayOutputStream().use { output ->
        check(ImageIO.write(image, "jpeg", output))
        output.toByteArray()
    }
}
