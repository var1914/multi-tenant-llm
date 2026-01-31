# =============================================================================
# ROUTE 53 DNS — A records pointing to EC2 Elastic IP
# =============================================================================
# Hosted zone was created manually; we reference it as a data source.
# DKIM CNAMEs, ACME TXT, NS/SOA are managed outside terraform.

data "aws_route53_zone" "main" {
  count = var.domain_name != "" ? 1 : 0
  name  = var.domain_name
}

# tokentrailapp.com → EIP
resource "aws_route53_record" "root" {
  count           = var.domain_name != "" ? 1 : 0
  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = var.domain_name
  type            = "A"
  ttl             = 300
  records         = [module.ec2.public_ip]
  allow_overwrite = true
}

# api.tokentrailapp.com → EIP
resource "aws_route53_record" "api" {
  count           = var.domain_name != "" ? 1 : 0
  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = "api.${var.domain_name}"
  type            = "A"
  ttl             = 300
  records         = [module.ec2.public_ip]
  allow_overwrite = true
}

# docs.tokentrailapp.com → EIP
resource "aws_route53_record" "docs" {
  count           = var.domain_name != "" ? 1 : 0
  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = "docs.${var.domain_name}"
  type            = "A"
  ttl             = 300
  records         = [module.ec2.public_ip]
  allow_overwrite = true
}
