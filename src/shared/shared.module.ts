import { Module, Global } from "@nestjs/common";
import { TemplateGeneratorService } from "./services/template-generator.service";

@Global()
@Module({
    providers: [TemplateGeneratorService],
    exports: [TemplateGeneratorService],
})
export class SharedModule {}
