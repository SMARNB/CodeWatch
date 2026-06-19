"""CodeWatch API views — reports domain (split from the monolithic api/views.py)."""
import os
import json
import re
import base64
import io
import cv2
import numpy as np
import redis
import secrets
import time
import calendar
from django.db.models.functions import TruncMonth, TruncDate, Lower

from django.contrib.auth import authenticate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count, Q
from ..models import TrackedPerson, ViolationLog, Camera, IncidentReport, Notification, Violation, UserProfile, Blacklist, MovementLog, VisitorLog, DressCodeRule
from ..serializers import DressCodeRuleSerializer
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_date
from django.utils import timezone
from datetime import timedelta
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from insightface.app import FaceAnalysis
from django.views.decorators.csrf import csrf_exempt
from django.core.paginator import Paginator
from rest_framework.decorators import permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.authtoken.models import Token

from .utils import (_rel_media, _MEDIA_ABS_RE, IsAdminRole, IsAdminOrSsdRole, _requester_scope, _auth_user_key_and_role, _person_scope_q, cosine_similarity, face_app, _person_embeddings)



# --- Send Report recipients ---------------------------------------------
# For the demo, point every role at the inbox you'll show on screen.
# (Later you can give each role its own address.)
_DEMO_INBOX = 'your-demo-inbox@gmail.com'   # <-- replace with a real inbox

REPORT_ROLE_EMAILS = {
    'admin':          [_DEMO_INBOX],
    'ssd':            [_DEMO_INBOX],
    'security':       [_DEMO_INBOX],
    'departmenthead': [_DEMO_INBOX],
    'depthead':       [_DEMO_INBOX],
    'guard':          [_DEMO_INBOX],
}

def _resolve_report_recipients(raw):
    """Comma/semicolon list of role names and/or emails -> clean email list."""
    out = []
    for token in (raw or '').replace(';', ',').split(','):
        t = token.strip()
        if not t:
            continue
        if '@' in t:                       # already an email
            out.append(t)
            continue
        key = ''.join(ch for ch in t.lower() if ch.isalnum())  # "Department Head" -> "departmenthead"
        out.extend(REPORT_ROLE_EMAILS.get(key, []))
    seen = set()
    return [e for e in out if not (e in seen or seen.add(e))]

def _generate_report_pdf(report):
    """Render an IncidentReport to PDF bytes from its stored data (server-side, no browser)."""
    import io, os, json as _json
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
    from django.conf import settings as dj_settings

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle('cw_h1', parent=styles['Heading1'], textColor=colors.HexColor('#3f4299'), fontSize=18)
    h2 = ParagraphStyle('cw_h2', parent=styles['Heading2'], textColor=colors.HexColor('#3f4299'), fontSize=13)
    meta = ParagraphStyle('cw_meta', parent=styles['Normal'], textColor=colors.HexColor('#666666'), fontSize=9)
    mono = ParagraphStyle('cw_mono', parent=styles['Normal'], fontName='Courier', fontSize=9, leading=12)
    story = []

    story.append(Paragraph(f"RPT-{report.id:04d} — {report.subject or 'Report'}", h1))
    created = report.created_at.strftime('%b %d, %Y %H:%M') if getattr(report, 'created_at', None) else ''
    story.append(Paragraph(
        f"Type: {report.report_type or 'General'} | Priority: {report.priority or 'Normal'} | "
        f"Status: {report.status or 'new'} | {created}", meta))
    story.append(Spacer(1, 10))

    if report.message:
        story.append(Paragraph("Report Content", h2))
        safe = (report.message or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')
        story.append(Paragraph(safe, mono))
        story.append(Spacer(1, 10))

    try:
        adata = _json.loads(report.analytics_json) if report.analytics_json else {}
    except Exception:
        adata = {}

    cards = adata.get('statCardsData') or []
    if cards:
        story.append(Paragraph("Key Metrics", h2))
        rows = [['Metric', 'Value', 'Change']]
        for c in cards:
            rows.append([str(c.get('title', '')), str(c.get('value', '')), str(c.get('percentageChange', '') or '')])
        t = Table(rows, hAlign='LEFT', colWidths=[90*mm, 35*mm, 35*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f4299')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f4f4fb')]),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    vd = adata.get('violator_details')
    if vd:
        story.append(Paragraph("Subject", h2))
        rows = [
            ['Name', str(vd.get('name', ''))],
            ['ID', str(vd.get('employee_id', ''))],
            ['Department', str(vd.get('department', ''))],
            ['Classification', str(vd.get('classification', ''))],
        ]
        t = Table(rows, hAlign='LEFT', colWidths=[40*mm, 120*mm])
        t.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f4f4fb')),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    moves = adata.get('movement_summary') or []
    if moves:
        story.append(Paragraph("Movement Summary", h2))
        rows = [['Camera', 'Location', 'Entered']]
        for m in moves[:30]:
            ent = str(m.get('entered_at') or '')[:19].replace('T', ' ')
            rows.append([str(m.get('camera_name', '')), str(m.get('location', '')), ent])
        t = Table(rows, hAlign='LEFT', colWidths=[40*mm, 80*mm, 40*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f4299')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    snaps = adata.get('snapshots') or []
    if snaps:
        media_url = getattr(dj_settings, 'MEDIA_URL', '/media/')
        media_root = getattr(dj_settings, 'MEDIA_ROOT', '')
        imgs = []
        for s in snaps[:4]:
            try:
                idx = s.find(media_url)
                if idx >= 0 and media_root:
                    rel = s[idx + len(media_url):]
                    fpath = os.path.join(media_root, rel)
                    if os.path.exists(fpath):
                        imgs.append(RLImage(fpath, width=42*mm, height=42*mm))
            except Exception:
                continue
        if imgs:
            story.append(Paragraph("Snapshots", h2))
            story.append(Table([imgs], hAlign='LEFT'))

    if len(story) <= 2:
        story.append(Paragraph("No additional content available.", styles['Normal']))

    doc.build(story)
    return buf.getvalue()


@api_view(['POST'])
def send_report(request):
    """
    Saves an incident report from the Modal and emails it to the recipients.
    """
    try:
        data = request.data
        person_id = data.get('personId')

        analytics_str = data.get('analytics_json')
        if person_id and analytics_str:
            import json
            from ..models import MovementLog, ViolationLog, TrackedPerson
            try:
                analytics_data = json.loads(analytics_str)
                person = TrackedPerson.objects.get(id=person_id)

                # Fetch movement logs
                movements = MovementLog.objects.filter(person_id=person_id).order_by('entered_at')
                movement_summary = []
                cameras_visited = set()
                total_duration_seconds = 0

                for m in movements:
                    duration = 0
                    if m.exited_at and m.entered_at:
                        duration = (m.exited_at - m.entered_at).total_seconds()
                        total_duration_seconds += duration

                    cameras_visited.add(m.camera_name)
                    movement_summary.append({
                        "camera_name": m.camera_name,
                        "location": m.location_description,
                        "entered_at": m.entered_at.isoformat() if m.entered_at else None,
                        "exited_at": m.exited_at.isoformat() if m.exited_at else None,
                        "duration": duration
                    })

                # Fetch snapshots (the field is snapshot_path on ViolationLog)
                violations = ViolationLog.objects.filter(person_id=person_id).exclude(snapshot_path='')
                snapshots = []
                for v in violations:
                    if v.snapshot_path:
                        snapshots.append(v.snapshot_path.url)

                analytics_data['movement_summary'] = movement_summary
                analytics_data['snapshots'] = snapshots
                analytics_data['total_time_seconds'] = total_duration_seconds
                analytics_data['cameras_visited_count'] = len(cameras_visited)
                analytics_data['violator_details'] = {
                    "name": person.name,
                    "employee_id": person.employee_id,
                    "department": person.department,
                    "classification": person.classification
                }

                analytics_str = json.dumps(analytics_data)
            except Exception as e:
                print(f"Failed to augment analytics_json: {e}")

        # Derive the analytics period from the selected date range (if any).
        resolved_report_type = data.get('reportType')
        _sd = data.get('startDate')
        _ed = data.get('endDate')
        if _sd and _ed:
            try:
                from datetime import datetime as _dt
                span = abs((_dt.strptime(str(_ed), '%Y-%m-%d') - _dt.strptime(str(_sd), '%Y-%m-%d')).days)
                if span <= 1:
                    resolved_report_type = 'daily'
                elif span <= 8:
                    resolved_report_type = 'weekly'
                elif span <= 35:
                    resolved_report_type = 'monthly'
                elif span <= 100:
                    resolved_report_type = 'quarterly'
                elif span <= 200:
                    resolved_report_type = 'half-yearly'
                else:
                    resolved_report_type = 'yearly'
                print(f"[send_report] date span {span}d -> type '{resolved_report_type}'")
            except Exception as _pe:
                print(f"[send_report] period parse failed: {_pe}")
        # Ensure department-head generated reports are properly scoped
        role, _dept = _requester_scope(request)
        final_message = data.get('message')
        if role == 'department-head' and _dept:
            if final_message:
                final_message = final_message.replace('Dept: All', f'Dept: {_dept}')
            if analytics_str:
                try:
                    import json
                    a_data = json.loads(analytics_str)
                    if 'filters' not in a_data:
                        a_data['filters'] = {}
                    if not a_data['filters'].get('department') or len(a_data['filters']['department']) == 0:
                        a_data['filters']['department'] = [_dept]
                    analytics_str = json.dumps(a_data)
                except Exception:
                    pass

        report = IncidentReport.objects.create(
            report_type=resolved_report_type,
            recipients=data.get('recipients'),
            subject=data.get('subject'),
            priority=data.get('priority'),
            message=final_message,
            related_person_id=person_id if person_id else None,
            analytics_json=analytics_str
        )

        # --- Email the report to any recipient that looks like an email address ---
        email_sent = False
        email_error = None
        try:
            to_list = _resolve_report_recipients(data.get('recipients'))
            print(f"[send_report] raw recipients={data.get('recipients')!r} -> resolved={to_list}")
            if to_list:
                from django.core.mail import send_mail
                from django.conf import settings as dj_settings
                # Use the same authenticated address the working violation emails use.
                from_addr = (getattr(dj_settings, 'EMAIL_HOST_USER', None)
                             or getattr(dj_settings, 'DEFAULT_FROM_EMAIL', None))
                priority = data.get('priority') or 'Normal'
                body_lines = [
                    data.get('message') or '',
                    '',
                    f"Type: {data.get('reportType') or 'General'}",
                    f"Priority: {priority}",
                ]
                try:
                    if analytics_str:
                        import json as _json
                        adata = _json.loads(analytics_str)
                        vd = adata.get('violator_details')
                        if vd:
                            body_lines.append(f"Subject of report: {vd.get('name')} ({vd.get('employee_id')}) — {vd.get('department')}")
                        snaps = adata.get('snapshots') or []
                        if snaps:
                            body_lines += ['', 'Snapshots:'] + snaps[:5]
                except Exception:
                    pass
                body_lines += ['', '— Code Watch']
                # --- Build the email and attach report PDFs ---
                from django.core.mail import EmailMessage
                subject_line = f"[Code Watch - {priority}] {data.get('subject') or 'Incident Report'}"
                email = EmailMessage(subject_line, "\n".join(body_lines), from_addr, to_list)
                covered_ids = set()
                # (A) Pixel-perfect PDF captured on the client (Report Details page)
                client_pdf = data.get('client_pdf')
                if client_pdf and client_pdf.get('base64'):
                    try:
                        import base64 as _b64
                        raw = client_pdf['base64']
                        if ',' in raw:
                            raw = raw.split(',', 1)[1]
                        pdf_bytes = _b64.b64decode(raw)
                        fname = client_pdf.get('filename') or 'report.pdf'
                        email.attach(fname, pdf_bytes, 'application/pdf')
                        if client_pdf.get('report_id') is not None:
                            covered_ids.add(client_pdf.get('report_id'))
                        print(f"[send_report] attached client PDF {fname} ({len(pdf_bytes)} bytes)")
                    except Exception as _cp_e:
                        print(f"[send_report] client PDF attach failed: {_cp_e}")
                # (B) Server-generated PDFs for any other attached reports (the picker)
                for rid in (data.get('attached_report_ids') or []):
                    if rid in covered_ids:
                        continue
                    try:
                        rep = IncidentReport.objects.get(id=rid)
                        pdf_bytes = _generate_report_pdf(rep)
                        email.attach(f"RPT-{rep.id:04d}.pdf", pdf_bytes, 'application/pdf')
                        print(f"[send_report] attached server PDF RPT-{rep.id:04d}.pdf ({len(pdf_bytes)} bytes)")
                    except IncidentReport.DoesNotExist:
                        continue
                    except Exception as _sp_e:
                        print(f"[send_report] server PDF for {rid} failed: {_sp_e}")
                print(f"[send_report] sending from={from_addr!r} to={to_list}")
                sent = email.send(fail_silently=False)
                print(f"[send_report] email.send returned {sent} (1 = handed to SMTP)")
                email_sent = bool(sent)
            else:
                email_error = "No valid recipient email address was provided."
                print("[send_report] resolved recipient list is EMPTY -> nothing emailed")
        except Exception as mail_e:
            import traceback
            email_error = str(mail_e)
            print(f"[send_report] EMAIL FAILED: {mail_e}")
            traceback.print_exc()

        return Response({
            "status": "success",
            "report_id": report.id,
            "email_sent": email_sent,
            "email_error": email_error,
        })
    except Exception as e:
        print(f"Report Error: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)
    
    
@api_view(['GET'])
def get_reports(request):
    """ Returns all incident reports from the database. """
    import json
    reports = IncidentReport.objects.select_related('related_person').all().order_by('created_at')
    
    role, dept = _requester_scope(request)

    data = []
    
    counters = {'analytics': 1, 'email': 1, 'violation': 1}
    prefixes = {'analytics': 'ANA', 'email': 'EML', 'violation': 'VIO'}
    
    for r in reports:
        if role == 'department-head' and dept:
            if r.related_person_id:
                if r.related_person.department != dept and r.related_person.classification != 'unknown':
                    continue
            else:
                allowed = False
                try:
                    if r.analytics_json:
                        a_data = json.loads(r.analytics_json)
                        dept_filter = a_data.get('filters', {}).get('department', [])
                        if dept in dept_filter:
                            allowed = True
                except Exception:
                    pass
                
                # Fallback check for older reports without explicit JSON filters
                if not allowed and r.message:
                    if f"Dept: {dept}" in r.message or "Dept: All" in r.message:
                        allowed = True

                if not allowed:
                    continue

        snapshot_url = None
        movement_summary = []
        analytics_data = {}
        try:
            if r.analytics_json:
                analytics_data = json.loads(r.analytics_json)
                if 'snapshots' in analytics_data and len(analytics_data['snapshots']) > 0:
                    snapshot_url = analytics_data['snapshots'][0]
                if 'movement_summary' in analytics_data:
                    movement_summary = analytics_data['movement_summary']
        except Exception:
            analytics_data = {}
            
        # Bucket the report for the Reports filters.
        if r.report_type == 'Violation Feedback':
            category = 'violation'
        elif r.recipients == 'System Archive':
            category = 'analytics'
        elif r.recipients and r.recipients != 'System Archive':
            category = 'email'
        elif snapshot_url or analytics_data.get('snapshots') or r.related_person_id:
            category = 'violation'
        else:
            category = 'analytics'
            
        custom_id = f"{prefixes[category]}-{counters[category]:04d}"
        counters[category] += 1
            
        data.append({
            "id": r.id,
            "custom_id": custom_id,
            "description": r.subject,
            "date": r.created_at,
            "type": r.report_type,
            "category": category,
            "recipients": r.recipients,
            "status": r.status,
            "note": r.resolution_note,
            "is_pinned": r.is_pinned,
            "related_person_id": r.related_person_id,
            "related_person_name": r.related_person.name if r.related_person else None,
            "priority": r.priority,
            "message": r.message,
            "analytics_json": _rel_media(r.analytics_json),
            "snapshot_url": _rel_media(snapshot_url),
            "movement_summary": movement_summary
        })
    # Sort the final list by is_pinned (descending) and created_at (descending)
    data.sort(key=lambda x: (not x['is_pinned'], -x['date'].timestamp()))
    
    return Response(data)

@api_view(['POST'])
def update_report(request, report_id):
    """ Update a report's status/note (+ pin), and optionally blacklist its related person. """
    from django.utils import timezone
    try:
        report = IncidentReport.objects.get(id=report_id)
    except IncidentReport.DoesNotExist:
        return Response({"status": "error", "message": "Report not found"}, status=404)

    status_val = (request.data.get('status') or '').strip().lower()
    if status_val:
        valid = ['new', 'in_review', 'resolved', 'dismissed', 'reviewed', 'archived']
        if status_val not in valid:
            return Response({"status": "error", "message": "Invalid status"}, status=400)
        report.status = status_val
        report.resolved_at = timezone.now() if status_val in ('resolved', 'dismissed', 'archived') else None

    if request.data.get('note') is not None:
        report.resolution_note = request.data.get('note')

    if 'is_pinned' in request.data:
        report.is_pinned = bool(request.data.get('is_pinned'))

    report.save()

    blacklisted = False
    if request.data.get('blacklist') and report.related_person_id:
        person = report.related_person
        entry = Blacklist.objects.filter(person=person).first()
        if entry:
            entry.is_active = True
            entry.save()
        else:
            Blacklist.objects.create(
                person=person,
                reason=f'Blacklisted from report #{report.id}',
                blacklist_type='manual',
                violation_threshold=0,
                added_by=request.user if request.user.is_authenticated else None
            )
        person.classification = 'blacklisted'
        person.save()
        blacklisted = True

    return Response({"status": "success", "blacklisted": blacklisted})

@api_view(['GET'])
def get_report_detail(request, report_id):
    """ Returns full details of a specific incident report """
    import json
    try:
        report = IncidentReport.objects.get(id=report_id)
        
        role, dept = _requester_scope(request)
        if role == 'department-head' and dept:
            if report.related_person_id:
                if report.related_person.department != dept and report.related_person.classification != 'unknown':
                    return Response({"status": "error", "message": "Unauthorized access to report."}, status=403)
            else:
                allowed = False
                try:
                    if report.analytics_json:
                        a_data = json.loads(report.analytics_json)
                        dept_filter = a_data.get('filters', {}).get('department', [])
                        if dept in dept_filter:
                            allowed = True
                except Exception:
                    pass
                if not allowed:
                    return Response({"status": "error", "message": "Unauthorized access to report."}, status=403)
        
        def get_category(r, a_data, s_url):
            if r.report_type == 'Violation Feedback':
                return 'violation'
            if r.recipients == 'System Archive':
                return 'analytics'
            if r.recipients and r.recipients != 'System Archive':
                return 'email'
            if s_url or a_data.get('snapshots') or r.related_person_id:
                return 'violation'
            return 'analytics'

        analytics_data = {}
        snapshot_url = None
        try:
            if report.analytics_json:
                analytics_data = json.loads(report.analytics_json)
                if 'snapshots' in analytics_data and len(analytics_data['snapshots']) > 0:
                    snapshot_url = analytics_data['snapshots'][0]
        except Exception:
            pass
            
        # Normalize any legacy absolute media URLs to relative so images load on LAN clients.
        snapshot_url = _rel_media(snapshot_url)
        if isinstance(analytics_data.get('snapshots'), list):
            analytics_data['snapshots'] = [_rel_media(s) for s in analytics_data['snapshots']]

        my_category = get_category(report, analytics_data, snapshot_url)
        
        # Calculate sequential rank by checking all older reports
        all_older = IncidentReport.objects.filter(created_at__lte=report.created_at).order_by('created_at')
        rank = 0
        for r in all_older:
            r_analytics = {}
            r_snap = None
            try:
                if r.analytics_json:
                    r_analytics = json.loads(r.analytics_json)
                    if 'snapshots' in r_analytics and len(r_analytics['snapshots']) > 0:
                        r_snap = r_analytics['snapshots'][0]
            except Exception: pass
            
            if get_category(r, r_analytics, r_snap) == my_category:
                rank += 1

        prefixes = {'analytics': 'ANA', 'email': 'EML', 'violation': 'VIO'}
        custom_id = f"{prefixes[my_category]}-{rank:04d}"

        return Response({
            "id": report.id,
            "custom_id": custom_id,
            "description": report.subject,
            "date": report.created_at,
            "type": report.report_type,
            "status": report.status or 'new',
            "resolution_note": report.resolution_note or '',
            "is_pinned": report.is_pinned,
            "related_person_id": report.related_person_id,
            "related_person_name": report.related_person.name if report.related_person else None,
            "priority": report.priority,
            "message": report.message,
            "recipients": report.recipients,
            "analytics_json": _rel_media(report.analytics_json),
            "analytics_data": analytics_data
        })
    except IncidentReport.DoesNotExist:
        return Response({"error": "Report not found"}, status=404)

@api_view(['DELETE'])
def delete_report(request, report_id):
    """ Deletes a report by ID. """
    try:
        report = IncidentReport.objects.get(id=report_id)
        report.delete()
        return Response({"status": "success"})
    except IncidentReport.DoesNotExist:
        return Response({"status": "error", "message": "Not found"}, status=404)
