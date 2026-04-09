import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RuntimeConfigService } from './runtime-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env']
    })
  ],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService]
})
export class RuntimeConfigModule {}
