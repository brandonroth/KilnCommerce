import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import { CfnStage } from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";
import * as path from "path";

export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── S3 + CloudFront ──────────────────────────────────────────────────────

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    // Next.js static export generates `shop.html`, `checkout/success.html`, etc.
    // but browsers request `/shop`, `/checkout/success`. S3 returns 403 for missing
    // keys (no exact match), so we rewrite paths to append .html before hitting S3.
    const urlRewriteFn = new cloudfront.Function(this, "UrlRewriteFunction", {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (/^\\/posts\\/[^\\/]+$/.test(uri)) {
            request.uri = '/posts/_shell.html';
            return request;
          }
          if (/^\\/order\\/[^\\/]+$/.test(uri)) {
            request.uri = '/order/_shell.html';
            return request;
          }
          if (/^\\/shop\\/[^\\/]+$/.test(uri)) {
            request.uri = '/shop/_shell.html';
            return request;
          }
          if (uri !== '/' && !uri.endsWith('/') && !uri.split('/').pop().includes('.')) {
            request.uri = uri + '.html';
          }
          return request;
        }
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
        functionAssociations: [{
          function: urlRewriteFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: "/404.html" },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: "/404.html" },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Deploy HTML, JS, CSS — prune old pages, but never touch the images/ prefix.
    // images/*.webp are gitignored build artifacts managed solely by the seed script;
    // if they were included here, prune:true would delete them on every cdk deploy.
    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../site/out"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      exclude: ["images/**"],
    });

    // Deploy committed image files (jpg originals etc.) separately with prune:false so
    // seed-uploaded optimised webp files are never deleted by a subsequent cdk deploy.
    new s3deploy.BucketDeployment(this, "DeployImages", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../site/out/images"))],
      destinationBucket: siteBucket,
      destinationKeyPrefix: "images",
      prune: false,
    });

    // ── Posts S3 Bucket ───────────────────────────────────────────────────────

    const postsBucket = new s3.Bucket(this, "PostsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, "DeployPosts", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../service/posts"))],
      destinationBucket: postsBucket,
    });

    // ── DynamoDB ─────────────────────────────────────────────────────────────

    const productsTable = new dynamodb.TableV2(this, "ProductsTable", {
      partitionKey: { name: "slug", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const ordersTable = new dynamodb.TableV2(this, "OrdersTable", {
      partitionKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      dynamoStream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const checkoutsTable = new dynamodb.TableV2(this, "CheckoutsTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const inquiriesTable = new dynamodb.TableV2(this, "InquiriesTable", {
      partitionKey: { name: "inquiryId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const subscriptionsTable = new dynamodb.TableV2(this, "SubscriptionsTable", {
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const settingsTable = new dynamodb.TableV2(this, "SettingsTable", {
      partitionKey: { name: "settingKey", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── Cognito (admin auth) ──────────────────────────────────────────────────

    const adminUserPool = new cognito.UserPool(this, "AdminUserPool", {
      userPoolName: "bees-bowls-admin",
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Browser clients can't keep a client secret — generateSecret must be false
    const adminUserPoolClient = new cognito.UserPoolClient(this, "AdminUserPoolClient", {
      userPool: adminUserPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    // ── Config ────────────────────────────────────────────────────────────────

    const cloudfrontUrl = `https://${distribution.distributionDomainName}`;
    // SITE_DOMAIN overrides the default CloudFront URL (e.g. "mystore.com" in production).
    // When set, both the custom domain and the CloudFront URL are treated as allowed origins
    // so the API works from either host.
    const siteDomain = process.env.SITE_DOMAIN;
    const siteUrl = siteDomain ? `https://${siteDomain}` : cloudfrontUrl;
    const allowedOrigins = siteDomain ? [siteUrl, cloudfrontUrl] : [siteUrl];
    const ownerEmail   = process.env.OWNER_EMAIL   ?? "owner@example.com";
    const fromEmail    = process.env.FROM_EMAIL    ?? "orders@example.com";
    const supportEmail = process.env.SUPPORT_EMAIL ?? "support@example.com";

    // ── Rate limits ───────────────────────────────────────────────────────────
    // BurstLimit: max concurrent requests in a spike.
    // RateLimit:  sustained requests per second.
    // Tune these up if you see legitimate 429s in the API Gateway logs.
    const RATE_LIMITS = {
      default:  { burst: 10, rate: 5  }, // general browsing (products, posts, orders)
      forms:    { burst: 3,  rate: 1  }, // /inquiry, /subscribe — main spam targets
      checkout: { burst: 5,  rate: 3  }, // /checkout, /shipping/rates
      webhook:  { burst: 10, rate: 5  }, // /webhook — Stripe may retry on failure
    };

    // ── Lambda ───────────────────────────────────────────────────────────────

    const productsLambda = new lambdaNode.NodejsFunction(this, "ProductsFunction", {
      entry: path.join(__dirname, "../lambda/products.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: productsTable.tableName,
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    productsTable.grantReadData(productsLambda);

    const ssmParamArn = `arn:aws:ssm:${this.region}:${this.account}:parameter/*`;

    const checkoutLambda = new lambdaNode.NodejsFunction(this, "CheckoutFunction", {
      entry: path.join(__dirname, "../lambda/checkout.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(15),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        CHECKOUTS_TABLE: checkoutsTable.tableName,
        SETTINGS_TABLE: settingsTable.tableName,
        STRIPE_SECRET_KEY_PATH: "/stripe-secret-key",
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
        // Optional: set TAX_RATE to a flat percentage (e.g. "8.25") as an env-level
        // fallback. The admin-configurable DynamoDB setting takes precedence when set.
        TAX_RATE: process.env.TAX_RATE ?? "",
      },
    });

    productsTable.grantWriteData(checkoutLambda);
    productsTable.grantReadData(checkoutLambda);
    checkoutsTable.grantWriteData(checkoutLambda);
    settingsTable.grantReadData(checkoutLambda);
    checkoutLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [ssmParamArn],
      })
    );

    const webhookLambda = new lambdaNode.NodejsFunction(this, "WebhookFunction", {
      entry: path.join(__dirname, "../lambda/webhook.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(15),
      environment: {
        CHECKOUTS_TABLE: checkoutsTable.tableName,
        PRODUCTS_TABLE: productsTable.tableName,
        ORDERS_TABLE: ordersTable.tableName,
        STRIPE_SECRET_KEY_PATH: "/stripe-secret-key",
        STRIPE_WEBHOOK_SECRET_PATH: "/stripe-webhook-secret",
      },
    });

    checkoutsTable.grantReadWriteData(webhookLambda);
    productsTable.grantWriteData(webhookLambda);
    ordersTable.grantWriteData(webhookLambda);
    webhookLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [ssmParamArn],
      })
    );

    const emailLambda = new lambdaNode.NodejsFunction(this, "EmailFunction", {
      entry: path.join(__dirname, "../lambda/email.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        FROM_EMAIL: fromEmail,
        OWNER_EMAIL: ownerEmail,
        SUPPORT_EMAIL: supportEmail,
        RESEND_API_KEY: process.env.RESEND_API_KEY!,
        SITE_URL: siteUrl,
      },
    });

    const shippoFromName    = process.env.SHIPPO_FROM_NAME    ?? "";
    const shippoFromStreet1 = process.env.SHIPPO_FROM_STREET1 ?? "";
    const shippoFromCity    = process.env.SHIPPO_FROM_CITY    ?? "American Fork";
    const shippoFromState   = process.env.SHIPPO_FROM_STATE   ?? "UT";
    const shippoFromZip     = process.env.SHIPPO_FROM_ZIP     ?? "84003";
    const shippoFromPhone   = process.env.SHIPPO_FROM_PHONE   ?? "";

    const shippingRatesLambda = new lambdaNode.NodejsFunction(this, "ShippingRatesFunction", {
      entry: path.join(__dirname, "../lambda/shipping-rates.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(15),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
        STRIPE_SECRET_KEY_PATH: "/stripe-secret-key",
        SHIPPO_API_KEY_PATH: "/shippo-api-key",
        SHIPPO_FROM_NAME:    shippoFromName,
        SHIPPO_FROM_STREET1: shippoFromStreet1,
        SHIPPO_FROM_CITY:    shippoFromCity,
        SHIPPO_FROM_STATE:   shippoFromState,
        SHIPPO_FROM_ZIP:     shippoFromZip,
        SHIPPO_FROM_PHONE:   shippoFromPhone,
      },
    });

    productsTable.grantReadData(shippingRatesLambda);
    shippingRatesLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [ssmParamArn],
      })
    );

    const shippingLambda = new lambdaNode.NodejsFunction(this, "ShippingFunction", {
      entry: path.join(__dirname, "../lambda/shipping.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        ORDERS_TABLE: ordersTable.tableName,
      },
    });

    ordersTable.grantReadWriteData(shippingLambda);

    const ordersLambda = new lambdaNode.NodejsFunction(this, "OrdersFunction", {
      entry: path.join(__dirname, "../lambda/orders.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        ORDERS_TABLE: ordersTable.tableName,
      },
    });

    ordersTable.grantReadData(ordersLambda);

    const postsLambda = new lambdaNode.NodejsFunction(this, "PostsFunction", {
      entry: path.join(__dirname, "../lambda/posts.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        POSTS_BUCKET: postsBucket.bucketName,
      },
    });

    postsBucket.grantRead(postsLambda);

    const inquiryLambda = new lambdaNode.NodejsFunction(this, "InquiryFunction", {
      entry: path.join(__dirname, "../lambda/inquiry.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        INQUIRIES_TABLE: inquiriesTable.tableName,
        FROM_EMAIL: fromEmail,
        OWNER_EMAIL: ownerEmail,
        RESEND_API_KEY: process.env.RESEND_API_KEY!,
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    inquiriesTable.grantWriteData(inquiryLambda);

    const subscribeLambda = new lambdaNode.NodejsFunction(this, "SubscribeFunction", {
      entry: path.join(__dirname, "../lambda/subscribe.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        SUBSCRIPTIONS_TABLE: subscriptionsTable.tableName,
        SETTINGS_TABLE: settingsTable.tableName,
        FROM_EMAIL: fromEmail,
        RESEND_API_KEY: process.env.RESEND_API_KEY!,
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    subscriptionsTable.grantWriteData(subscribeLambda);
    settingsTable.grantReadData(subscribeLambda);

    const settingsLambda = new lambdaNode.NodejsFunction(this, "SettingsFunction", {
      entry: path.join(__dirname, "../lambda/settings.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        SETTINGS_TABLE: settingsTable.tableName,
        SITE_URL: siteUrl,
        ALLOWED_ORIGINS: allowedOrigins.join(","),
      },
    });

    settingsTable.grantReadData(settingsLambda);

    const adminLambda = new lambdaNode.NodejsFunction(this, "AdminFunction", {
      entry: path.join(__dirname, "../lambda/admin.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        ORDERS_TABLE: ordersTable.tableName,
        CHECKOUTS_TABLE: checkoutsTable.tableName,
        INQUIRIES_TABLE: inquiriesTable.tableName,
        SUBSCRIPTIONS_TABLE: subscriptionsTable.tableName,
        SETTINGS_TABLE: settingsTable.tableName,
      },
    });

    productsTable.grantReadWriteData(adminLambda); // write: PATCH /admin/products/{slug}, POST /admin/products
    ordersTable.grantReadWriteData(adminLambda);   // write: PATCH /admin/orders/{orderId} (notes)
    checkoutsTable.grantReadData(adminLambda);
    inquiriesTable.grantReadData(adminLambda);
    subscriptionsTable.grantReadData(adminLambda);
    settingsTable.grantReadWriteData(adminLambda); // write: PUT /admin/settings/{key}

    // Image upload Lambda — stores browser-processed WebP images in S3.
    // The browser handles resize + WebP conversion before upload, so no native
    // modules are needed here.
    const imageUploadLambda = new lambdaNode.NodejsFunction(this, "ImageUploadFunction", {
      entry: path.join(__dirname, "../lambda/image-upload.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        SITE_BUCKET: siteBucket.bucketName,
      },
    });

    // Restrict image uploads to the images/ prefix only
    imageUploadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:PutObject"],
      resources: [`${siteBucket.bucketArn}/images/*`],
    }));

    emailLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(ordersTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 1,
        retryAttempts: 2,
      })
    );

    // ── HTTP API Gateway ──────────────────────────────────────────────────────

    const api = new apigatewayv2.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: allowedOrigins,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // Apply throttling via L1 escape hatch — HTTP API v2 doesn't expose this in L2 constructs.
    // DefaultRouteSettings is the fallback for any route not listed in RouteSettings.
    const cfnStage = api.defaultStage?.node.defaultChild as CfnStage;
    cfnStage?.addPropertyOverride("DefaultRouteSettings", {
      ThrottlingBurstLimit: RATE_LIMITS.default.burst,
      ThrottlingRateLimit:  RATE_LIMITS.default.rate,
    });
    cfnStage?.addPropertyOverride("RouteSettings", {
      "POST /inquiry":        { ThrottlingBurstLimit: RATE_LIMITS.forms.burst,    ThrottlingRateLimit: RATE_LIMITS.forms.rate    },
      "POST /subscribe":      { ThrottlingBurstLimit: RATE_LIMITS.forms.burst,    ThrottlingRateLimit: RATE_LIMITS.forms.rate    },
      "POST /checkout":       { ThrottlingBurstLimit: RATE_LIMITS.checkout.burst, ThrottlingRateLimit: RATE_LIMITS.checkout.rate },
      "DELETE /checkout/{sessionId}": { ThrottlingBurstLimit: RATE_LIMITS.checkout.burst, ThrottlingRateLimit: RATE_LIMITS.checkout.rate },
      "POST /shipping/rates": { ThrottlingBurstLimit: RATE_LIMITS.checkout.burst, ThrottlingRateLimit: RATE_LIMITS.checkout.rate },
      "POST /webhook":        { ThrottlingBurstLimit: RATE_LIMITS.webhook.burst,  ThrottlingRateLimit: RATE_LIMITS.webhook.rate  },
    });

    const productsIntegration = new integrations.HttpLambdaIntegration(
      "ProductsIntegration",
      productsLambda
    );
    const checkoutIntegration = new integrations.HttpLambdaIntegration(
      "CheckoutIntegration",
      checkoutLambda
    );
    const webhookIntegration = new integrations.HttpLambdaIntegration(
      "WebhookIntegration",
      webhookLambda
    );

    const inquiryIntegration = new integrations.HttpLambdaIntegration("InquiryIntegration", inquiryLambda);
    const postsIntegration = new integrations.HttpLambdaIntegration("PostsIntegration", postsLambda);
    const subscribeIntegration = new integrations.HttpLambdaIntegration("SubscribeIntegration", subscribeLambda);
    const adminIntegration = new integrations.HttpLambdaIntegration("AdminIntegration", adminLambda);
    const settingsIntegration = new integrations.HttpLambdaIntegration("SettingsIntegration", settingsLambda);
    const imageUploadIntegration = new integrations.HttpLambdaIntegration("ImageUploadIntegration", imageUploadLambda);
    const shippingRatesIntegration = new integrations.HttpLambdaIntegration("ShippingRatesIntegration", shippingRatesLambda);
    const shippingIntegration      = new integrations.HttpLambdaIntegration("ShippingIntegration", shippingLambda);
    const ordersIntegration        = new integrations.HttpLambdaIntegration("OrdersIntegration", ordersLambda);
    // JWT authorizer — validates Cognito tokens before requests reach the Lambda
    const adminAuthorizer = new authorizers.HttpJwtAuthorizer(
      "AdminAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${adminUserPool.userPoolId}`,
      { jwtAudience: [adminUserPoolClient.userPoolClientId] }
    );

    api.addRoutes({ path: "/settings", methods: [apigatewayv2.HttpMethod.GET], integration: settingsIntegration });
    api.addRoutes({ path: "/products", methods: [apigatewayv2.HttpMethod.GET], integration: productsIntegration });
    api.addRoutes({ path: "/products/{slug}", methods: [apigatewayv2.HttpMethod.GET], integration: productsIntegration });
    api.addRoutes({ path: "/checkout", methods: [apigatewayv2.HttpMethod.POST], integration: checkoutIntegration });
    api.addRoutes({ path: "/checkout/{sessionId}", methods: [apigatewayv2.HttpMethod.DELETE], integration: checkoutIntegration });
    api.addRoutes({ path: "/webhook", methods: [apigatewayv2.HttpMethod.POST], integration: webhookIntegration });
    api.addRoutes({ path: "/inquiry", methods: [apigatewayv2.HttpMethod.POST], integration: inquiryIntegration });
    api.addRoutes({ path: "/subscribe", methods: [apigatewayv2.HttpMethod.POST], integration: subscribeIntegration });
    api.addRoutes({ path: "/posts", methods: [apigatewayv2.HttpMethod.GET], integration: postsIntegration });
    api.addRoutes({ path: "/posts/{slug}", methods: [apigatewayv2.HttpMethod.GET], integration: postsIntegration });
    api.addRoutes({ path: "/admin/settings", methods: [apigatewayv2.HttpMethod.GET], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/settings/{key}", methods: [apigatewayv2.HttpMethod.PUT], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/{table}", methods: [apigatewayv2.HttpMethod.GET], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/products", methods: [apigatewayv2.HttpMethod.POST], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/products/{slug}", methods: [apigatewayv2.HttpMethod.PATCH], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/upload-image", methods: [apigatewayv2.HttpMethod.POST], integration: imageUploadIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/admin/orders/{orderId}", methods: [apigatewayv2.HttpMethod.PATCH], integration: adminIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/shipping/rates", methods: [apigatewayv2.HttpMethod.POST], integration: shippingRatesIntegration });
    api.addRoutes({ path: "/admin/orders/{orderId}/shipping", methods: [apigatewayv2.HttpMethod.PATCH], integration: shippingIntegration, authorizer: adminAuthorizer });
    api.addRoutes({ path: "/orders/{orderId}", methods: [apigatewayv2.HttpMethod.GET], integration: ordersIntegration });
    // ── Outputs ───────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Public site URL (CloudFront)",
    });
    new cdk.CfnOutput(this, "BucketName", {
      value: siteBucket.bucketName,
      description: "S3 bucket holding static assets",
    });
    new cdk.CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
      description: "DynamoDB products table name",
    });
    new cdk.CfnOutput(this, "OrdersTableName", {
      value: ordersTable.tableName,
      description: "DynamoDB orders table name",
    });
    new cdk.CfnOutput(this, "CheckoutsTableName", {
      value: checkoutsTable.tableName,
      description: "DynamoDB checkouts table name",
    });
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url!,
      description: "HTTP API Gateway URL",
    });
    new cdk.CfnOutput(this, "AdminUserPoolId", {
      value: adminUserPool.userPoolId,
      description: "Cognito User Pool ID for admin console",
    });
    new cdk.CfnOutput(this, "AdminUserPoolClientId", {
      value: adminUserPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID for admin console",
    });
  }
}
