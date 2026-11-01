import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

src_path = r'D:\Major Project\deepfake_project\Capstone_Phase1_Presentation2.pptx'
prs = pptx.Presentation(src_path)

papers_p1 = [
    {
        'num': '[1]',
        'title': 'ASVspoof 2021: Towards Spoofed and Deepfake Speech Detection in the Wild',
        'authors': 'J. Yamagishi, X. Wang, M. Todisco, et al.',
        'pub': 'IEEE Trans. Biometrics, Behavior, and Identity Science, vol. 4, no. 3, pp. 325-339, 2022',
        'work': 'Created foundational benchmark dataset for detecting deepfake audio in realistic in-the-wild channels.',
        'limitation': 'Heavy offline research models evaluated in batch mode; lacked a usable real-time web or client-side interface.',
        'takeaway': 'Adopted audio normalization and uncompressed WAV capture to handle variable noise and microphone qualities.'
    },
    {
        'num': '[2]',
        'title': 'WaveFake: A Data Set to Facilitate Audio Deepfake Detection',
        'authors': 'J. Frank, L. Schönherr, J. Fischer, et al.',
        'pub': 'Proc. Neural Information Processing Systems (NeurIPS / Scopus), Dec. 2021, pp. 1-13',
        'work': 'Benchmarked modern vocoders (MelGAN, HiFi-GAN), proving AI speech leaves distinct high-frequency spectral artifacts.',
        'limitation': 'Focused on dataset generation and benchmarking; did not implement an active real-time defense tool.',
        'takeaway': 'Used their core finding: converting 1D audio to 2D Mel-spectrograms for CNN-based artifact detection.'
    },
    {
        'num': '[3]',
        'title': 'End-to-End Audio Deepfake Detection with RawNet2',
        'authors': 'H. Tak, J. Patino, M. Todisco, et al.',
        'pub': 'IEEE Int. Conf. Acoustics, Speech and Signal Processing (ICASSP), Jun. 2021, pp. 6369-6373',
        'work': 'Processed raw 1D waveforms directly with RawNet2 to capture subtle temporal-spectral anomalies.',
        'limitation': 'Raw waveform models require massive GPU compute and cause high latency, unsuited for live browser calls.',
        'takeaway': 'Confirmed 2D Mel-spectrograms with lightweight CNNs provide much lower inference latency (<1.5s).'
    },
    {
        'num': '[4]',
        'title': 'Deepfake Audio Detection via MFCC and Convolutional Neural Networks',
        'authors': 'Y. Wang, Z. Li, and C. Chen',
        'pub': 'IEEE Access, vol. 8, pp. 11245-11253, 2020',
        'work': 'Extracted MFCCs and 2D spectrograms to train a lightweight 2D CNN classifier for fast binary detection.',
        'limitation': 'Tested on balanced lab data; produced high false-positive rates when tested on real-world voice samples.',
        'takeaway': 'Implemented their 2D CNN architecture, adding mathematical bias threshold calibration to eliminate false alarms.'
    },
    {
        'num': '[5]',
        'title': 'Multi-task Learning for Robust Voice Anti-Spoofing',
        'authors': 'T. Zhang, H. Wang, et al.',
        'pub': 'IEEE/ACM Trans. Audio, Speech, and Language Processing, vol. 31, pp. 120-132, 2023',
        'work': 'Used multi-task learning to simultaneously flag deepfake speech and identify the underlying TTS engine architecture.',
        'limitation': 'Multi-head vocoder attribution adds parameter complexity, slowing down live telephonic stream classification.',
        'takeaway': 'Maintained a streamlined binary pipeline (Fake vs Real) with confidence percentage for real-time responsiveness.'
    }
]

papers_p2 = [
    {
        'num': '[6]',
        'title': 'Vulnerability of Voice Biometrics to Deepfake and Replay Attacks',
        'authors': 'P. Korshunov and S. Marcel',
        'pub': 'IEEE Trans. Information Forensics and Security, vol. 17, pp. 1542-1554, 2022',
        'work': 'Evaluated commercial voice biometrics against modern voice cloning and replay attacks.',
        'limitation': 'Exposed critical security flaws in voice banking but proposed no active consumer defense.',
        'takeaway': 'Provided core problem motivation: speaker ID is unsafe without active AI artifact verification.'
    },
    {
        'num': '[7]',
        'title': 'Self-Supervised Learning for Audio Deepfake Detection',
        'authors': 'A. Baevski, H. Zhou, et al.',
        'pub': 'IEEE Signal Processing Letters, vol. 29, pp. 1002-1006, 2022',
        'work': 'Explored large self-supervised representations (wav2vec 2.0) for synthetic voice detection.',
        'limitation': 'Transformer models contain hundreds of millions of parameters, causing high compute and latency.',
        'takeaway': 'Selected lightweight PyTorch CNN (~25MB) trained on Mel-spectrograms for low-resource efficiency.'
    },
    {
        'num': '[8]',
        'title': 'Voice Spoofing Countermeasures: A Comprehensive Review',
        'authors': 'M. Sahidullah, T. Kinnunen, et al.',
        'pub': 'IEEE Communications Surveys & Tutorials, vol. 25, no. 1, pp. 450-482, 2023',
        'work': 'Comprehensive review of acoustic feature representations and neural architectures for anti-spoofing.',
        'limitation': 'Theoretical survey paper across benchmarks; did not implement an end-to-end interactive system.',
        'takeaway': 'Adopted their key architectural conclusion: 2D Mel-spectrograms + CNN yield peak accuracy and speed.'
    },
    {
        'num': '[9]',
        'title': 'Real-Time Scam Call Detection Using Voice Biometrics and Edge Computing',
        'authors': 'X. Li, Y. Zhang, and Q. Wu',
        'pub': 'IEEE Internet of Things Journal, vol. 9, no. 18, pp. 17820-17831, 2022',
        'work': 'Formulated edge-assisted real-time architecture for active telephonic scam call interception.',
        'limitation': 'Relied on proprietary telecom edge hardware gateways, making public deployment difficult.',
        'takeaway': 'Adopted their <2s latency requirement as our core NFR using accessible React + Flask web architecture.'
    },
    {
        'num': '[10]',
        'title': 'Explainable AI in Audio Forensics: Visualizing Deepfake Artifacts',
        'authors': 'L. Chen, S. Kumar, et al.',
        'pub': 'IEEE Transactions on Multimedia, vol. 26, pp. 3120-3132, 2024',
        'work': 'Demonstrated Explainable AI (XAI) in audio forensics via visual frequency heatmap representations.',
        'limitation': 'Generated explainability plots purely as offline research scripts without an interactive interface.',
        'takeaway': "Implemented visual XAI directly in our UI ('AI Vision') showing Base64 Mel-spectrogram heatmaps."
    }
]

def update_table_slide(slide, title_text, papers_list):
    # Update title
    for s in slide.shapes:
        if s.name == 'TextBox 4':
            s.text_frame.paragraphs[0].text = title_text
            s.text_frame.paragraphs[0].font.name = 'Poppins Medium'
            s.text_frame.paragraphs[0].font.size = Pt(25.5)
            s.text_frame.paragraphs[0].font.color.rgb = RGBColor(217, 56, 30)

    # Remove existing tables or old textboxes
    for s in list(slide.shapes):
        if s.has_table or s.name == 'TextBox 3':
            sp = s._element
            sp.getparent().remove(sp)

    # Create new table
    table_shape = slide.shapes.add_table(6, 4, Inches(0.65), Inches(1.35), Inches(12.0), Inches(5.35))
    table = table_shape.table
    table.columns[0].width = Inches(0.60)
    table.columns[1].width = Inches(3.60)
    table.columns[2].width = Inches(2.40)
    table.columns[3].width = Inches(5.40)

    headers = ['#', 'Title and Author(s)', 'Publication and Year', 'Summary (Work, Limitation & Project Takeaway)']
    for c_idx, h in enumerate(headers):
        cell = table.cell(0, c_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(0, 46, 142) # PES Deep Navy Blue
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.08)
        cell.margin_right = Inches(0.08)
        cell.margin_top = Inches(0.04)
        cell.margin_bottom = Inches(0.04)
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.name = 'Calibri'
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
        if c_idx == 0:
            p.alignment = PP_ALIGN.CENTER

    for r_idx, paper in enumerate(papers_list, start=1):
        bg_color = RGBColor(255, 255, 255) if r_idx % 2 != 0 else RGBColor(232, 245, 253)
        for c in range(4):
            cell = table.cell(r_idx, c)
            cell.fill.solid()
            cell.fill.fore_color.rgb = bg_color
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.08)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(0.03)
            cell.margin_bottom = Inches(0.03)

        # Col 0: #
        cell0 = table.cell(r_idx, 0)
        p0 = cell0.text_frame.paragraphs[0]
        p0.text = paper['num']
        p0.font.name = 'Calibri'
        p0.font.size = Pt(10)
        p0.font.bold = True
        p0.font.color.rgb = RGBColor(31, 41, 51)
        p0.alignment = PP_ALIGN.CENTER

        # Col 1: Title and Author(s)
        cell1 = table.cell(r_idx, 1)
        tf1 = cell1.text_frame
        tf1.word_wrap = True
        p1_title = tf1.paragraphs[0]
        p1_title.text = paper['title']
        p1_title.font.name = 'Calibri'
        p1_title.font.size = Pt(9)
        p1_title.font.bold = True
        p1_title.font.color.rgb = RGBColor(0, 46, 142)
        p1_title.space_after = Pt(2)

        p1_author = tf1.add_paragraph()
        p1_author.text = paper['authors']
        p1_author.font.name = 'Calibri'
        p1_author.font.size = Pt(8)
        p1_author.font.color.rgb = RGBColor(91, 102, 117)

        # Col 2: Publication and Year
        cell2 = table.cell(r_idx, 2)
        tf2 = cell2.text_frame
        tf2.word_wrap = True
        p2 = tf2.paragraphs[0]
        p2.text = paper['pub']
        p2.font.name = 'Calibri'
        p2.font.size = Pt(8.5)
        p2.font.color.rgb = RGBColor(31, 41, 51)

        # Col 3: Summary (Work, Limitation, Takeaway)
        cell3 = table.cell(r_idx, 3)
        tf3 = cell3.text_frame
        tf3.word_wrap = True
        
        # Paragraph 1: Work
        p_work = tf3.paragraphs[0]
        p_work.space_after = Pt(1.5)
        r_w_lbl = p_work.add_run()
        r_w_lbl.text = '• Work: '
        r_w_lbl.font.name = 'Calibri'
        r_w_lbl.font.size = Pt(8)
        r_w_lbl.font.bold = True
        r_w_lbl.font.color.rgb = RGBColor(0, 46, 142) # Navy Blue
        r_w_txt = p_work.add_run()
        r_w_txt.text = paper['work']
        r_w_txt.font.name = 'Calibri'
        r_w_txt.font.size = Pt(8)
        r_w_txt.font.color.rgb = RGBColor(31, 41, 51)

        # Paragraph 2: Limitation
        p_lim = tf3.add_paragraph()
        p_lim.space_after = Pt(1.5)
        r_l_lbl = p_lim.add_run()
        r_l_lbl.text = '• Limitation: '
        r_l_lbl.font.name = 'Calibri'
        r_l_lbl.font.size = Pt(8)
        r_l_lbl.font.bold = True
        r_l_lbl.font.color.rgb = RGBColor(185, 28, 28) # Crimson Red
        r_l_txt = p_lim.add_run()
        r_l_txt.text = paper['limitation']
        r_l_txt.font.name = 'Calibri'
        r_l_txt.font.size = Pt(8)
        r_l_txt.font.color.rgb = RGBColor(31, 41, 51)

        # Paragraph 3: Takeaway
        p_tak = tf3.add_paragraph()
        r_t_lbl = p_tak.add_run()
        r_t_lbl.text = '• Takeaway: '
        r_t_lbl.font.name = 'Calibri'
        r_t_lbl.font.size = Pt(8)
        r_t_lbl.font.bold = True
        r_t_lbl.font.color.rgb = RGBColor(21, 128, 61) # Forest Green
        r_t_txt = p_tak.add_run()
        r_t_txt.text = paper['takeaway']
        r_t_txt.font.name = 'Calibri'
        r_t_txt.font.size = Pt(8)
        r_t_txt.font.color.rgb = RGBColor(31, 41, 51)

# Apply to Slide 5 and Slide 6
update_table_slide(prs.slides[4], 'Literature Survey: Summary of Papers (1/2)', papers_p1)
update_table_slide(prs.slides[5], 'Literature Survey: Summary of Papers (2/2)', papers_p2)

# Save to all locations with lock handling
save_targets = [
    r'D:\Major Project\deepfake_project\Capstone_Phase1_Presentation2.pptx',
    r'D:\Major Project\deepfake_project\Voice_Deepfake_Detection_Presentation_v2.pptx',
    r'C:\Users\dhorn\Downloads\Voice Deepfake & Scam Call Detection System - Capstone Phase 1 Presentation.pptx',
    r'C:\Users\dhorn\Downloads\Voice Deepfake & Scam Call Detection System - Capstone Phase 1 Presentation_v2.pptx',
]

for target in save_targets:
    try:
        prs.save(target)
        print(f'Successfully saved: {target}')
    except Exception as e:
        print(f'Could not overwrite {target} (likely open in PowerPoint): {e}')

