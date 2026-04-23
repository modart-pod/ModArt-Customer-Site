# Uptime Monitoring Setup Guide

## Overview

This document provides instructions for setting up uptime monitoring for the ModArt application using various monitoring services.

## Recommended Services

### 1. UptimeRobot (Free Tier Available)

**Features:**
- 50 monitors on free plan
- 5-minute check intervals
- Email/SMS/Slack alerts
- Public status pages
- SSL certificate monitoring

**Setup:**
1. Sign up at https://uptimerobot.com
2. Create monitors for:
   - Main site: `https://modart.com`
   - API health: `https://modart.com/api/csrf-token`
   - Admin panel: `https://modart.com/admin.html`
3. Configure alert contacts (email, SMS, Slack)
4. Set up status page (optional)

**Configuration:**
```
Monitor Type: HTTPS
URL: https://modart.com
Monitoring Interval: 5 minutes
Alert Contacts: your-email@example.com
```

### 2. Pingdom (Paid, More Features)

**Features:**
- Real user monitoring
- Transaction monitoring
- Page speed monitoring
- Detailed reports

**Setup:**
1. Sign up at https://www.pingdom.com
2. Add uptime checks
3. Configure alerts
4. Set up integrations (Slack, PagerDuty, etc.)

### 3. Better Uptime (Modern Alternative)

**Features:**
- Beautiful status pages
- Incident management
- On-call scheduling
- Integrations with Slack, Discord, etc.

**Setup:**
1. Sign up at https://betteruptime.com
2. Create monitors
3. Configure on-call schedule
4. Set up status page

## Monitoring Endpoints

### Critical Endpoints

| Endpoint | Type | Expected Response | Alert Threshold |
|----------|------|-------------------|-----------------|
| `https://modart.com` | HTTP | 200 OK | 2 failures |
| `https://modart.com/api/csrf-token` | HTTP | 200 OK | 1 failure |
| `https://modart.com/admin.html` | HTTP | 200 OK | 2 failures |

### Optional Endpoints

| Endpoint | Type | Expected Response | Alert Threshold |
|----------|------|-------------------|-----------------|
| `https://modart.com/sitemap.xml` | HTTP | 200 OK | 3 failures |
| `https://modart.com/robots.txt` | HTTP | 200 OK | 3 failures |

## Alert Configuration

### Alert Channels

1. **Email Alerts**
   - Primary: admin@modart.com
   - Secondary: dev-team@modart.com
   - Escalation: cto@modart.com (after 15 minutes)

2. **Slack Alerts**
   - Channel: #alerts
   - Mention: @on-call

3. **SMS Alerts** (Critical Only)
   - On-call engineer
   - Only for main site downtime

### Alert Rules

```yaml
Critical (Immediate):
  - Main site down (2 consecutive failures)
  - API endpoint down (1 failure)
  - Response time > 5 seconds

Warning (5 minutes):
  - Response time > 3 seconds
  - SSL certificate expiring in 7 days

Info (15 minutes):
  - Response time > 2 seconds
  - Minor endpoint issues
```

## Status Page

### Public Status Page

Create a public status page to communicate with users:

**URL:** `https://status.modart.com`

**Components to Monitor:**
- Website
- API
- Admin Panel
- Payment Processing
- Email Delivery

**Incident Communication:**
- Real-time status updates
- Incident history
- Scheduled maintenance notices
- Subscribe to updates

### Example Status Page (UptimeRobot)

1. Go to UptimeRobot dashboard
2. Click "Add Status Page"
3. Select monitors to display
4. Customize branding
5. Publish and share URL

## Health Check Endpoint

Create a dedicated health check endpoint for monitoring:

**File:** `api/health.js`

```javascript
export default async function handler(req, res) {
  // Check database connection
  const dbHealthy = await checkDatabase();
  
  // Check external services
  const servicesHealthy = await checkServices();
  
  const healthy = dbHealthy && servicesHealthy;
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy,
      services: servicesHealthy,
    },
  });
}
```

## Monitoring Best Practices

### 1. Monitor from Multiple Locations

Set up monitors from different geographic regions:
- North America
- Europe
- Asia

This helps identify regional issues.

### 2. Set Appropriate Check Intervals

- Critical endpoints: 1-5 minutes
- Non-critical endpoints: 10-15 minutes
- Background jobs: 30-60 minutes

### 3. Configure Escalation

```
0 min: Alert on-call engineer (Slack)
5 min: Send email to team
15 min: Send SMS to on-call
30 min: Escalate to manager
```

### 4. Maintenance Windows

Schedule maintenance windows to avoid false alerts:
- Weekly: Sunday 2-4 AM UTC
- Monthly: First Sunday 2-6 AM UTC

### 5. Response Time Thresholds

```
Excellent: < 500ms
Good: 500ms - 1s
Warning: 1s - 3s
Critical: > 3s
```

## Integration with Sentry

Link uptime monitoring with Sentry for correlation:

```javascript
// In Sentry config
Sentry.init({
  beforeSend(event) {
    // Add uptime status to error context
    event.contexts = {
      ...event.contexts,
      uptime: {
        status: window.uptimeStatus,
        lastCheck: window.lastUptimeCheck,
      },
    };
    return event;
  },
});
```

## Runbook for Downtime

### When Site is Down

1. **Verify the Issue**
   - Check monitoring dashboard
   - Verify from multiple locations
   - Check status page

2. **Investigate**
   - Check Vercel dashboard
   - Check Supabase status
   - Review recent deployments
   - Check error logs in Sentry

3. **Communicate**
   - Update status page
   - Notify team in Slack
   - Post on social media if extended

4. **Resolve**
   - Roll back if recent deployment
   - Scale up if traffic spike
   - Contact support if provider issue

5. **Post-Mortem**
   - Document incident
   - Identify root cause
   - Implement preventive measures

## Metrics to Track

### Uptime Metrics

- **Uptime Percentage:** Target 99.9% (43 minutes downtime/month)
- **MTBF (Mean Time Between Failures):** Target > 30 days
- **MTTR (Mean Time To Recovery):** Target < 15 minutes

### Performance Metrics

- **Response Time:** Target < 1 second
- **Availability:** Target 99.9%
- **Error Rate:** Target < 0.1%

## Cost Estimate

### Free Tier (Recommended for Start)

- UptimeRobot Free: $0/month
  - 50 monitors
  - 5-minute intervals
  - Email alerts

### Paid Tier (For Growth)

- UptimeRobot Pro: $7/month
  - 50 monitors
  - 1-minute intervals
  - SMS alerts
  - Advanced reports

- Better Uptime: $20/month
  - Unlimited monitors
  - 30-second intervals
  - Status page
  - Incident management

## Setup Checklist

- [ ] Sign up for monitoring service
- [ ] Add main site monitor
- [ ] Add API endpoint monitor
- [ ] Add admin panel monitor
- [ ] Configure email alerts
- [ ] Configure Slack alerts
- [ ] Set up status page
- [ ] Test alerts
- [ ] Document runbook
- [ ] Train team on incident response

## Resources

- [UptimeRobot Documentation](https://uptimerobot.com/api/)
- [Better Uptime Documentation](https://docs.betteruptime.com/)
- [Pingdom Documentation](https://www.pingdom.com/resources/)
- [Status Page Best Practices](https://www.atlassian.com/incident-management/kpis/status-page)

## Next Steps

1. Choose a monitoring service (UptimeRobot recommended for start)
2. Set up monitors for critical endpoints
3. Configure alert channels
4. Create public status page
5. Test alert system
6. Document incident response procedures

---

**Last Updated:** June 28, 2025  
**Owner:** DevOps Team  
**Review:** Quarterly
