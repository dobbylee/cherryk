package io.github.dobbylee.cherryk.infrastructure.image

import com.drew.imaging.ImageMetadataReader
import com.drew.metadata.exif.ExifIFD0Directory
import io.github.dobbylee.cherryk.application.ocr.OcrImage
import io.github.dobbylee.cherryk.application.ocr.OcrImageFormat
import io.github.dobbylee.cherryk.application.ocr.OcrImageNormalizationFailure
import io.github.dobbylee.cherryk.application.ocr.OcrImageNormalizationException
import io.github.dobbylee.cherryk.application.ocr.OcrImageNormalizer
import org.springframework.stereotype.Component
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.AffineTransform
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam
import javax.imageio.stream.MemoryCacheImageInputStream
import javax.imageio.stream.MemoryCacheImageOutputStream

@Component
class Java2dOcrImageNormalizer : OcrImageNormalizer {
    override fun normalize(bytes: ByteArray): OcrImage {
        val sourceFormat =
            SourceImageFormat.detect(bytes)
                ?: throw OcrImageNormalizationException(
                    reason = OcrImageNormalizationFailure.INVALID_FORMAT,
                    message = "Upload a valid JPEG, PNG, or WebP image.",
                )

        try {
            val decoded = decode(bytes)
            val oriented = applyOrientation(decoded, readOrientation(bytes))
            val resized = resize(oriented)
            val outputFormat =
                if (sourceFormat == SourceImageFormat.JPEG) {
                    OcrImageFormat.JPEG
                } else {
                    OcrImageFormat.PNG
                }
            return OcrImage(
                bytes = encode(resized, outputFormat),
                format = outputFormat,
            )
        } catch (exception: OcrImageNormalizationException) {
            throw exception
        } catch (exception: Exception) {
            throw OcrImageNormalizationException(
                reason = OcrImageNormalizationFailure.PROCESSING_FAILED,
                message = "Image could not be processed.",
                cause = exception,
            )
        }
    }

    private fun decode(bytes: ByteArray): BufferedImage {
        val imageInput = MemoryCacheImageInputStream(ByteArrayInputStream(bytes))
        imageInput.use { input ->
            val readers = ImageIO.getImageReaders(input)
            if (!readers.hasNext()) {
                throw processingFailure("Image format is unsupported or corrupt.")
            }
            val reader = readers.next()
            try {
                reader.setInput(input, true, true)
                val width = reader.getWidth(0)
                val height = reader.getHeight(0)
                if (
                    width <= 0 ||
                    height <= 0 ||
                    width.toLong() * height.toLong() > MAX_OCR_INPUT_PIXELS
                ) {
                    throw processingFailure("Image dimensions are invalid.")
                }
                val subsampling = calculateSubsampling(width, height)
                val readParameters =
                    reader.defaultReadParam.apply {
                        setSourceSubsampling(subsampling, subsampling, 0, 0)
                    }
                return reader.read(0, readParameters)
                    ?: throw processingFailure("Image could not be decoded.")
            } finally {
                reader.dispose()
            }
        }
    }

    private fun readOrientation(bytes: ByteArray): Int {
        return try {
            ImageMetadataReader
                .readMetadata(ByteArrayInputStream(bytes))
                .getFirstDirectoryOfType(ExifIFD0Directory::class.java)
                ?.getInteger(ExifIFD0Directory.TAG_ORIENTATION)
                ?.takeIf { it in 1..8 }
                ?: 1
        } catch (_: Exception) {
            1
        }
    }

    private fun applyOrientation(
        source: BufferedImage,
        orientation: Int,
    ): BufferedImage {
        if (orientation == 1) {
            return source
        }
        val width = source.width
        val height = source.height
        val swapsDimensions = orientation in 5..8
        val target =
            BufferedImage(
                if (swapsDimensions) height else width,
                if (swapsDimensions) width else height,
                source.compatibleType(),
            )
        val transform =
            when (orientation) {
                2 -> AffineTransform(-1.0, 0.0, 0.0, 1.0, width.toDouble(), 0.0)
                3 ->
                    AffineTransform(
                        -1.0,
                        0.0,
                        0.0,
                        -1.0,
                        width.toDouble(),
                        height.toDouble(),
                    )
                4 -> AffineTransform(1.0, 0.0, 0.0, -1.0, 0.0, height.toDouble())
                5 -> AffineTransform(0.0, 1.0, 1.0, 0.0, 0.0, 0.0)
                6 -> AffineTransform(0.0, 1.0, -1.0, 0.0, height.toDouble(), 0.0)
                7 ->
                    AffineTransform(
                        0.0,
                        -1.0,
                        -1.0,
                        0.0,
                        height.toDouble(),
                        width.toDouble(),
                    )
                8 -> AffineTransform(0.0, -1.0, 1.0, 0.0, 0.0, width.toDouble())
                else -> return source
            }
        target.createGraphics().useGraphics { graphics ->
            graphics.drawImage(source, transform, null)
        }
        return target
    }

    private fun resize(source: BufferedImage): BufferedImage {
        val scale =
            minOf(
                1.0,
                MAX_OCR_IMAGE_DIMENSION.toDouble() / maxOf(source.width, source.height),
            )
        if (scale == 1.0) {
            return source
        }
        val width = maxOf(1, (source.width * scale).toInt())
        val height = maxOf(1, (source.height * scale).toInt())
        val target = BufferedImage(width, height, source.compatibleType())
        target.createGraphics().useGraphics { graphics ->
            graphics.setRenderingHint(
                RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BICUBIC,
            )
            graphics.setRenderingHint(
                RenderingHints.KEY_RENDERING,
                RenderingHints.VALUE_RENDER_QUALITY,
            )
            graphics.drawImage(source, 0, 0, width, height, null)
        }
        return target
    }

    private fun encode(
        source: BufferedImage,
        format: OcrImageFormat,
    ): ByteArray {
        val formatName = if (format == OcrImageFormat.JPEG) "jpeg" else "png"
        val writer =
            ImageIO.getImageWritersByFormatName(formatName).asSequence().firstOrNull()
                ?: throw processingFailure("Image encoder is unavailable.")
        val output = ByteArrayOutputStream()
        val imageOutput = MemoryCacheImageOutputStream(output)
        imageOutput.use {
            writer.output = it
            val parameters =
                writer.defaultWriteParam.apply {
                    if (format == OcrImageFormat.JPEG && canWriteCompressed()) {
                        compressionMode = ImageWriteParam.MODE_EXPLICIT
                        compressionQuality = JPEG_QUALITY
                    }
                }
            try {
                writer.write(null, IIOImage(source.forEncoding(format), null, null), parameters)
            } finally {
                writer.dispose()
            }
        }
        return output.toByteArray()
    }
}

private enum class SourceImageFormat {
    JPEG,
    PNG,
    WEBP,
    ;

    companion object {
        fun detect(bytes: ByteArray): SourceImageFormat? =
            when {
                bytes.hasPrefix(0xFF, 0xD8, 0xFF) -> JPEG
                bytes.hasPrefix(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) -> PNG
                bytes.hasPrefix(0x52, 0x49, 0x46, 0x46) &&
                    bytes.size >= 12 &&
                    bytes.sliceArray(8 until 12).contentEquals("WEBP".toByteArray()) -> WEBP
                else -> null
            }
    }
}

private fun ByteArray.hasPrefix(vararg expected: Int): Boolean =
    expected.indices.all { index -> getOrNull(index)?.toInt()?.and(0xFF) == expected[index] }

internal fun calculateSubsampling(
    width: Int,
    height: Int,
): Int = maxOf(1, (maxOf(width, height) - 1) / MAX_OCR_IMAGE_DIMENSION)

private fun processingFailure(message: String) =
    OcrImageNormalizationException(
        reason = OcrImageNormalizationFailure.PROCESSING_FAILED,
        message = message,
    )

private fun BufferedImage.compatibleType(): Int =
    if (colorModel.hasAlpha()) BufferedImage.TYPE_INT_ARGB else BufferedImage.TYPE_INT_RGB

private fun BufferedImage.forEncoding(format: OcrImageFormat): BufferedImage {
    if (format != OcrImageFormat.JPEG || type == BufferedImage.TYPE_INT_RGB) {
        return this
    }
    return BufferedImage(width, height, BufferedImage.TYPE_INT_RGB).also { target ->
        target.createGraphics().useGraphics { graphics ->
            graphics.drawImage(this, 0, 0, null)
        }
    }
}

private inline fun <R> Graphics2D.useGraphics(block: (Graphics2D) -> R): R =
    try {
        block(this)
    } finally {
        dispose()
    }

const val MAX_OCR_IMAGE_DIMENSION = 2048
private const val MAX_OCR_INPUT_PIXELS = 64_000_000L
private const val JPEG_QUALITY = 0.9f
