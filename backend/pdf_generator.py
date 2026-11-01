import os
import io
import base64
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_forensic_pdf(scan_data, output_stream):
    """
    Generates a formal forensic PDF analysis report.
    scan_data dict expects:
      id, filename, timestamp, audio_hash,
      voice_prediction, voice_confidence,
      scam_prediction, scam_confidence,
      transcript, keywords, combined_verdict,
      risk_level, spectrogram_b64
    """
    doc = SimpleDocTemplate(
        output_stream,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#002E8E')
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#4B5563')
    )
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=10,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1F2937')
    )
    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=1, # Center
        textColor=colors.white
    )

    story = []

    # 1. Header Table (Branding)
    header_data = [
        [
            Paragraph("<b>VOICESHIELD AI FORENSIC AUDIT REPORT</b>", title_style),
            Paragraph("<b>PES UNIVERSITY</b><br/>MCA Capstone Project", subtitle_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[4.5 * inch, 2.5 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT')
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#002E8E'), spaceAfter=10))

    # 2. Verdict Banner
    risk = scan_data.get('risk_level', 'SAFE').upper()
    if risk == 'CRITICAL':
        banner_bg = colors.HexColor('#DC2626')
    elif risk == 'HIGH':
        banner_bg = colors.HexColor('#EA580C')
    else:
        banner_bg = colors.HexColor('#16A34A')

    verdict_text = scan_data.get('combined_verdict', 'AUTHENTIC CALL (SAFE)')
    banner_data = [[Paragraph(f"AUDIT VERDICT: {verdict_text}", badge_style)]]
    banner_table = Table(banner_data, colWidths=[7.0 * inch])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), banner_bg),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER')
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 12))

    # 3. Audio & Forensic Metadata
    story.append(Paragraph("<b>1. Chain of Custody & Metadata</b>", h2_style))
    meta_data = [
        [
            Paragraph("<b>Evidence File:</b>", body_style),
            Paragraph(str(scan_data.get('filename', 'audio_sample.wav')), body_style),
            Paragraph("<b>Analysis Date:</b>", body_style),
            Paragraph(str(scan_data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))), body_style)
        ],
        [
            Paragraph("<b>SHA-256 Hash:</b>", body_style),
            Paragraph(f"<font size=7 color='#4B5563'>{scan_data.get('audio_hash', 'N/A')[:32]}...</font>", body_style),
            Paragraph("<b>Audit ID:</b>", body_style),
            Paragraph(f"VS-AUDIT-{scan_data.get('id', 'LIVE')}", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[1.3 * inch, 2.3 * inch, 1.2 * inch, 2.2 * inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5)
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 4. Layer 1: Acoustic Forensic Analysis
    story.append(Paragraph("<b>2. Layer 1: Acoustic Deepfake & Synthesis Analysis</b>", h2_style))
    v_pred = scan_data.get('voice_prediction', 'REAL')
    v_conf = scan_data.get('voice_confidence', 0.0)
    
    acoustic_summary = f"<b>Prediction:</b> {'🚨 AI-GENERATED (DEEPFAKE)' if v_pred == 'FAKE' else '✅ GENUINE HUMAN SPEECH'}<br/>"
    acoustic_summary += f"<b>CNN Confidence:</b> {v_conf}%<br/>"
    acoustic_summary += f"<b>Acoustic Features:</b> 128-band Mel-Spectrogram with high-frequency vocoder artifact inspection."
    
    acoustic_cell = Paragraph(acoustic_summary, body_style)

    # Process spectrogram image if available
    spec_img = None
    b64_str = scan_data.get('spectrogram_b64')
    if b64_str:
        try:
            img_data = base64.b64decode(b64_str)
            img_io = io.BytesIO(img_data)
            spec_img = RLImage(img_io, width=2.4 * inch, height=1.7 * inch)
        except Exception:
            spec_img = Paragraph("<i>Spectrogram display unavailable</i>", body_style)
    else:
        spec_img = Paragraph("<i>No spectrogram recorded</i>", body_style)

    acoustic_table_data = [[acoustic_cell, spec_img]]
    acoustic_table = Table(acoustic_table_data, colWidths=[4.4 * inch, 2.6 * inch])
    acoustic_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
    ]))
    story.append(acoustic_table)
    story.append(Spacer(1, 10))

    # 5. Layer 2: Conversational Intent Analysis
    story.append(Paragraph("<b>3. Layer 2: Conversational Intent & Social Engineering Scan</b>", h2_style))
    s_pred = scan_data.get('scam_prediction', 'SAFE')
    s_conf = scan_data.get('scam_confidence', 0.0)
    transcript = scan_data.get('transcript', '') or 'No speech transcribed or silence.'
    keywords = scan_data.get('keywords', [])
    kw_str = ", ".join(keywords) if keywords else "None detected"

    intent_data = [
        [Paragraph("<b>Intent Risk:</b>", body_style), Paragraph(f"<b>{'⚠️ FRAUD / SCAM' if s_pred == 'SCAM' else '✅ SAFE'}</b> ({s_conf}% confidence)", body_style)],
        [Paragraph("<b>Flagged Keywords:</b>", body_style), Paragraph(f"<font color='#B91C1C'><b>{kw_str}</b></font>", body_style)],
        [Paragraph("<b>Full Transcript:</b>", body_style), Paragraph(f"<i>\"{transcript}\"</i>", body_style)]
    ]
    intent_table = Table(intent_data, colWidths=[1.8 * inch, 5.2 * inch])
    intent_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5)
    ]))
    story.append(intent_table)
    story.append(Spacer(1, 12))

    # 6. Recommended Protocol & Signature
    story.append(Paragraph("<b>4. Recommended Security Action</b>", h2_style))
    if risk == 'CRITICAL':
        rec_text = "<b>HIGH SEVERITY ALERT:</b> Do not transfer money, share OTPs, or grant remote access. Terminate connection immediately and report the number to the Cyber Crime cell."
    elif risk == 'HIGH':
        rec_text = "<b>SUSPICIOUS ACTIVITY:</b> Verify caller credentials independently through a verified company hotline. Do not disclose sensitive account data."
    else:
        rec_text = "<b>NORMAL ACTIVITY:</b> No malicious vocal synthesis or fraud indicators detected. Standard operational vigilance recommended."
    
    rec_table = Table([[Paragraph(rec_text, body_style)]], colWidths=[7.0 * inch])
    rec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#3B82F6')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
    ]))
    story.append(rec_table)
    story.append(Spacer(1, 15))

    footer_text = "<font size=8 color='#64748B'>Report cryptographically generated by VoiceShield AI Engine. Dual-Layer PyTorch CNN + NLP Intent Pipeline. PES University MCA Capstone.</font>"
    story.append(Paragraph(footer_text, ParagraphStyle('Footer', alignment=1)))

    doc.build(story)
    output_stream.seek(0)
    return output_stream
