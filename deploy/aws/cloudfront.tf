# ---------------------------------------------------------------------------
# CloudFront in front of the ALB.
#
# Gives the deployment a public HTTPS URL on a *.cloudfront.net hostname,
# using the default CloudFront certificate. AWS does not issue certificates
# for *.elb.amazonaws.com, so this is the way to get HTTPS without owning a
# domain. To use a custom domain later, set acm_certificate_arn and add an
# alias + certificate to this distribution.
# ---------------------------------------------------------------------------

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# AllViewerExceptHostHeader: forwards Authorization, cookies, query strings
# and bodies, but leaves Host as the ALB's own name so it accepts the request.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.service_name} HTTPS front"
  price_class     = "PriceClass_100"

  origin {
    domain_name = aws_lb.app.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]

    # The app is dynamic: every request goes to origin, nothing is cached.
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The default certificate only supports TLSv1 as the minimum protocol
  # version; a stronger floor needs a custom ACM certificate.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = local.service_name }
}
