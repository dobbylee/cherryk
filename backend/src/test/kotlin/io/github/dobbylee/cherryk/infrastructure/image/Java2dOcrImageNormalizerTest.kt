package io.github.dobbylee.cherryk.infrastructure.image

import com.drew.imaging.ImageMetadataReader
import com.drew.metadata.exif.ExifIFD0Directory
import io.github.dobbylee.cherryk.application.ocr.OcrImageFormat
import io.github.dobbylee.cherryk.application.ocr.OcrImageNormalizationException
import org.junit.jupiter.api.Test
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.util.Base64
import java.util.zip.CRC32
import java.util.zip.DeflaterOutputStream
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class Java2dOcrImageNormalizerTest {
    private val normalizer = Java2dOcrImageNormalizer()

    @Test
    fun `resizes a large image without changing its aspect ratio`() {
        val source = createImage(width = 4096, height = 2048, format = "png")

        val normalized = normalizer.normalize(source)
        val decoded = ImageIO.read(ByteArrayInputStream(normalized.bytes))

        assertEquals(OcrImageFormat.PNG, normalized.format)
        assertEquals(MAX_OCR_IMAGE_DIMENSION, decoded.width)
        assertEquals(MAX_OCR_IMAGE_DIMENSION / 2, decoded.height)
    }

    @Test
    fun `applies EXIF orientation without enlarging and strips the metadata`() {
        val jpeg = createImage(width = 1200, height = 800, format = "jpeg")
        val orientedJpeg = jpeg.withExifOrientation(6)

        val normalized = normalizer.normalize(orientedJpeg)
        val decoded = ImageIO.read(ByteArrayInputStream(normalized.bytes))
        val orientation =
            ImageMetadataReader
                .readMetadata(ByteArrayInputStream(normalized.bytes))
                .getFirstDirectoryOfType(ExifIFD0Directory::class.java)
                ?.getInteger(ExifIFD0Directory.TAG_ORIENTATION)

        assertEquals(OcrImageFormat.JPEG, normalized.format)
        assertEquals(800, decoded.width)
        assertEquals(1200, decoded.height)
        assertNull(orientation)
    }

    @Test
    fun `converts WebP input to PNG for CLOVA`() {
        val webp = Base64.getDecoder().decode(TINY_WEBP)

        val normalized = normalizer.normalize(webp)
        val decoded = ImageIO.read(ByteArrayInputStream(normalized.bytes))

        assertEquals(OcrImageFormat.PNG, normalized.format)
        assertEquals(3, decoded.width)
        assertEquals(2, decoded.height)
    }

    @Test
    fun `subsamples a near-limit oriented image before its exact final resize`() {
        val source = createLargeOrientedPng(width = 10_000, height = 6_400, orientation = 6)
        assertTrue(source.size < 5 * 1024 * 1024)
        assertEquals(4, calculateSubsampling(width = 10_000, height = 6_400))

        val normalized = normalizer.normalize(source)
        val decoded = ImageIO.read(ByteArrayInputStream(normalized.bytes))

        assertEquals(OcrImageFormat.PNG, normalized.format)
        assertEquals(1_310, decoded.width)
        assertEquals(MAX_OCR_IMAGE_DIMENSION, decoded.height)
    }

    @Test
    fun `keeps thin alternating strokes through bicubic downscaling`() {
        val image = BufferedImage(4096, 64, BufferedImage.TYPE_INT_RGB)
        for (x in 0 until image.width) {
            val color = if (x % 2 == 0) Color.BLACK.rgb else Color.WHITE.rgb
            for (y in 0 until image.height) {
                image.setRGB(x, y, color)
            }
        }
        val source =
            ByteArrayOutputStream().use { output ->
                check(ImageIO.write(image, "png", output))
                output.toByteArray()
            }

        assertEquals(1, calculateSubsampling(width = 4096, height = 64))
        val normalized = normalizer.normalize(source)
        val decoded = ImageIO.read(ByteArrayInputStream(normalized.bytes))
        val middleGrayValues =
            (0 until decoded.width)
                .map { x -> Color(decoded.getRGB(x, decoded.height / 2)).red }
                .filter { it in 16..239 }

        assertEquals(MAX_OCR_IMAGE_DIMENSION, decoded.width)
        assertTrue(middleGrayValues.isNotEmpty())
    }

    @Test
    fun `rejects corrupt and unsupported images`() {
        assertFailsWith<OcrImageNormalizationException> {
            normalizer.normalize(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
        }
        assertFailsWith<OcrImageNormalizationException> {
            normalizer.normalize("GIF89a".toByteArray())
        }
    }
}

private fun createImage(
    width: Int,
    height: Int,
    format: String,
): ByteArray {
    val image = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
    image.createGraphics().also { graphics ->
        try {
            graphics.color = Color.WHITE
            graphics.fillRect(0, 0, width, height)
        } finally {
            graphics.dispose()
        }
    }
    return ByteArrayOutputStream().use { output ->
        check(ImageIO.write(image, format, output))
        output.toByteArray()
    }
}

private fun ByteArray.withExifOrientation(orientation: Int): ByteArray {
    require(size >= 2 && this[0] == 0xFF.toByte() && this[1] == 0xD8.toByte())
    require(orientation in 1..8)
    val exifSegment =
        byteArrayOf(
            0xFF.toByte(),
            0xE1.toByte(),
            0x00,
            0x22,
            'E'.code.toByte(),
            'x'.code.toByte(),
            'i'.code.toByte(),
            'f'.code.toByte(),
            0x00,
            0x00,
            'I'.code.toByte(),
            'I'.code.toByte(),
            0x2A,
            0x00,
            0x08,
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x12,
            0x01,
            0x03,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            orientation.toByte(),
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
        )
    return copyOfRange(0, 2) + exifSegment + copyOfRange(2, size)
}

private fun createLargeOrientedPng(
    width: Int,
    height: Int,
    orientation: Int,
): ByteArray {
    require(width.toLong() * height.toLong() <= 64_000_000L)
    require(orientation in 1..8)
    val compressedPixels =
        ByteArrayOutputStream().use { compressed ->
            DeflaterOutputStream(compressed).use { deflater ->
                val row = ByteArray(width + 1)
                repeat(height) {
                    deflater.write(row)
                }
            }
            compressed.toByteArray()
        }
    return ByteArrayOutputStream().use { png ->
        DataOutputStream(png).use { output ->
            output.write(PNG_SIGNATURE)
            output.writePngChunk(
                "IHDR",
                ByteArrayOutputStream().use { header ->
                    DataOutputStream(header).use {
                        it.writeInt(width)
                        it.writeInt(height)
                        it.writeByte(8)
                        it.writeByte(0)
                        it.writeByte(0)
                        it.writeByte(0)
                        it.writeByte(0)
                    }
                    header.toByteArray()
                },
            )
            output.writePngChunk("eXIf", tiffOrientation(orientation))
            output.writePngChunk("IDAT", compressedPixels)
            output.writePngChunk("IEND", byteArrayOf())
        }
        png.toByteArray()
    }
}

private fun DataOutputStream.writePngChunk(
    type: String,
    data: ByteArray,
) {
    val typeBytes = type.toByteArray(Charsets.US_ASCII)
    val crc = CRC32().apply {
        update(typeBytes)
        update(data)
    }
    writeInt(data.size)
    write(typeBytes)
    write(data)
    writeInt(crc.value.toInt())
}

private fun tiffOrientation(orientation: Int): ByteArray =
    byteArrayOf(
        'I'.code.toByte(),
        'I'.code.toByte(),
        0x2A,
        0x00,
        0x08,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x12,
        0x01,
        0x03,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        orientation.toByte(),
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
    )

private val PNG_SIGNATURE =
    byteArrayOf(
        0x89.toByte(),
        0x50,
        0x4E,
        0x47,
        0x0D,
        0x0A,
        0x1A,
        0x0A,
    )

private const val TINY_WEBP = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoDAAIAAUAmJaQAA3AA/vz0AAA="
